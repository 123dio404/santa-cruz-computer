from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from .models import Usuario, Persona, Bitacora
from .serializers import UsuarioSerializer
from .utils import validar_complejidad_password, generar_token_recuperacion

def registrar_bitacora(usuario, accion, username_intento=None, request=None):
    ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
    
    Bitacora.objects.create(
        usuario=usuario,
        username_intento=username_intento,
        accion=accion,
        ip_address=ip
    )

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({'error': 'Usuario y contraseña requeridos'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        usuario = Usuario.objects.get(username=username)
    except Usuario.DoesNotExist:
        registrar_bitacora(None, 'failed_login', username_intento=username, request=request)
        return Response({'error': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)
    
    # Verificar si está bloqueado
    if usuario.es_bloqueado():
        return Response({
            'error': f'Cuenta bloqueada temporalmente. Intente de nuevo después de {usuario.bloqueado_hasta}'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Verificar password
    if check_password(password, usuario.password_hash):
        # Login exitoso
        usuario.intentos_fallidos = 0
        usuario.bloqueado_hasta = None
        usuario.save()
        
        # En el sistema real de Django, necesitamos un usuario de Django para el Token.
        # Pero aquí estamos usando nuestro propio modelo Usuario. 
        # Para que Token funcione sin cambiar el AUTH_USER_MODEL, usaremos una respuesta simple por ahora
        # o vincularemos a un usuario de Django si fuera necesario.
        # Dado que queremos cumplir con la bitácora:
        registrar_bitacora(usuario, 'login', request=request)
        
        return Response({
            'message': 'Login exitoso',
            'user': UsuarioSerializer(usuario).data,
            'token': 'mock-token-' + str(usuario.persona.id_persona) # Simplificado para este ejercicio
        })
    else:
        # Intento fallido
        usuario.intentos_fallidos += 1
        if usuario.intentos_fallidos >= 3:
            usuario.bloqueado_hasta = timezone.now() + timedelta(minutes=15)
            registrar_bitacora(usuario, 'failed_login', request=request)
            usuario.save()
            return Response({'error': 'Cuenta bloqueada por 3 intentos fallidos'}, status=status.HTTP_403_FORBIDDEN)
        
        usuario.save()
        registrar_bitacora(usuario, 'failed_login', request=request)
        return Response({'error': f'Contraseña incorrecta. Intento {usuario.intentos_fallidos} de 3.'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    data = request.data
    password = data.get('password')
    
    # Validar password
    es_valida, mensaje = validar_complejidad_password(password)
    if not es_valida:
        return Response({'error': mensaje}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        persona = Persona.objects.create(
            nombre=data.get('name'),
            correo=data.get('email'),
            telefono=data.get('phone')
        )
        
        usuario = Usuario.objects.create(
            persona=persona,
            username=data.get('username'),
            rol=data.get('role', 'client'),
            password_hash=make_password(password)
        )
        
        return Response({'message': 'Usuario registrado exitosamente'}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def logout_view(request):
    # En un sistema real buscaríamos el usuario del token
    # Aquí simplificamos recibiendo el id del usuario por ahora
    user_id = request.data.get('user_id')
    try:
        usuario = Usuario.objects.get(persona__id_persona=user_id)
        registrar_bitacora(usuario, 'logout', request=request)
        return Response({'message': 'Cierre de sesión registrado'})
    except:
        return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_view(request):
    username = request.data.get('username')
    try:
        usuario = Usuario.objects.get(username=username)
        token = generar_token_recuperacion()
        usuario.token_recuperacion = token
        usuario.token_expiracion = timezone.now() + timedelta(hours=1)
        usuario.save()
        
        # Enviar correo a la consola
        send_mail(
            'Recuperación de Contraseña - SantaCruz Computer',
            f'Tu código de recuperación es: {token}',
            'noreply@santacruzcomputer.com',
            [usuario.persona.correo],
            fail_silently=False,
        )
        
        return Response({'message': 'Se ha enviado un código a su correo registrado'})
    except Usuario.DoesNotExist:
        return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_view(request):
    username = request.data.get('username')
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    try:
        usuario = Usuario.objects.get(username=username, token_recuperacion=token)
        
        if usuario.token_expiracion < timezone.now():
            return Response({'error': 'El token ha expirado'}, status=status.HTTP_400_BAD_REQUEST)
        
        es_valida, mensaje = validar_complejidad_password(new_password)
        if not es_valida:
            return Response({'error': mensaje}, status=status.HTTP_400_BAD_REQUEST)
        
        usuario.password_hash = make_password(new_password)
        usuario.token_recuperacion = None
        usuario.token_expiracion = None
        usuario.intentos_fallidos = 0
        usuario.bloqueado_hasta = None
        usuario.save()
        
        registrar_bitacora(usuario, 'password_change', request=request)
        
        return Response({'message': 'Contraseña actualizada correctamente'})
    except Usuario.DoesNotExist:
        return Response({'error': 'Token o usuario inválido'}, status=status.HTTP_400_BAD_REQUEST)
