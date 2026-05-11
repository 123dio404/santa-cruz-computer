"""
views.py — Vistas del módulo de Usuarios

Contiene toda la lógica de autenticación y gestión de usuarios del sistema.

AUTENTICACIÓN JWT:
  El token JWT se genera con rest_framework_simplejwt y contiene:
  { user_id, username, name, email, role, telefono }
  No hay refresh tokens — el token expira según SIMPLE_JWT en settings.py.

BLOQUEO DE CUENTAS (_failed dict en memoria):
  Los intentos fallidos se rastrean en el dict _failed.
  Esquema de bloqueo progresivo:
  - 3 intentos → bloqueo temporal 1 minuto
  - 6 intentos → bloqueo temporal 5 minutos
  - 7+ intentos → bloqueo permanente (requiere desbloqueo del admin)
  ADVERTENCIA: _failed se resetea si el servidor se reinicia.

RECUPERACIÓN DE CONTRASEÑA (_otps dict en memoria):
  Los OTPs son 6 caracteres alfanuméricos en mayúsculas (ej: AB3X9K).
  Expiran a los 15 minutos. Funcionan para tabla 'usuario' y 'cliente'.
  ADVERTENCIA: _otps se resetea si el servidor se reinicia.

CORREO OTP:
  Enviado por SMTP usando Resend (smtp.resend.com:465 con SSL).
  Configurado en .env con EMAIL_HOST_PASSWORD = re_<api_key>.
"""
import random
import string
import time
from collections import defaultdict
from datetime import timedelta

from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings as django_settings
from django.contrib.auth.hashers import make_password

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Usuario, Cliente
from .serializers import UsuarioSerializer, ClienteSerializer
from apps.audit.utils import log_action, actor_from_request

# Rastrea intentos fallidos de login: username → {count, locked_until (timestamp)}
_failed: dict = defaultdict(lambda: {'count': 0, 'locked_until': 0.0})

# Almacena OTPs activos en memoria (tabla otp_recovery no existe en la BD)
# clave: identifier (username o correo) → {code, expires_at, email, entity_id, tabla}
_otps: dict = {}


class LoginView(APIView):
    """
    POST /api/v1/users/login/
    Body: {"email": "...", "password": "..."}

    Block rules (mirror the frontend rules):
      3 failed attempts → 1-minute block (429)
      6 failed attempts → 5-minute block (429)
      >6 attempts      → permanent block until server restart (429)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.db import connection
        from django.contrib.auth.hashers import check_password as check_pw

        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')

        if not username:
            return Response({'error': 'username es requerido'}, status=status.HTTP_400_BAD_REQUEST)

        now = time.time()
        rec = _failed[username]

        # ── Check block ───────────────────────────────────────────────────────
        if rec['locked_until'] == float('inf'):
            return Response(
                {'error': 'Cuenta bloqueada permanentemente. Contacta al administrador.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if rec['locked_until'] > now:
            remaining_s = int(rec['locked_until'] - now)
            remaining_m = max(1, round(remaining_s / 60))
            return Response(
                {'error': f'Cuenta bloqueada temporalmente. Intenta en {remaining_m} minuto(s).'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # ── 1. Buscar en tabla usuario ────────────────────────────────────────
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT idusuario, username, nombre_completo, rol, activo, password_hash "
                    "FROM usuario WHERE username = %s LIMIT 1",
                    [username]
                )
                row = cursor.fetchone()
        except Exception as e:
            return Response(
                {'error': f'Error de base de datos: {type(e).__name__}: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # ── 2. Si no está en usuario, buscar en cliente ───────────────────────
        is_cliente = False
        if row is None:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT idcliente, usuario_login, nombre, apellido, correo, password "
                        "FROM cliente WHERE usuario_login = %s LIMIT 1",
                        [username]
                    )
                    cliente_row = cursor.fetchone()
            except Exception as e:
                return Response(
                    {'error': f'Error de base de datos: {type(e).__name__}: {e}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            if cliente_row is None:
                return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)

            c_id, c_login, c_nombre, c_apellido, c_correo, c_password = cliente_row
            db_id           = c_id
            db_username     = c_login or username
            db_name         = f'{c_nombre} {c_apellido}'.strip()
            db_role         = 'cliente'
            db_activo       = True
            db_email        = c_correo or ''
            db_password_hash = c_password
            is_cliente      = True
        else:
            db_id, db_username, db_name, db_role, db_activo, db_password_hash = row
            db_email = ''

        # ── 3. Verificar contraseña ───────────────────────────────────────────
        if password and db_password_hash:
            if not check_pw(password, db_password_hash):
                rec['count'] += 1
                count = rec['count']

                if count > 6:
                    rec['locked_until'] = float('inf')
                    return Response(
                        {'error': 'Cuenta bloqueada permanentemente por seguridad. Contacta al administrador.'},
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )
                elif count >= 6:
                    rec['locked_until'] = now + 300  # 5 min
                    return Response(
                        {'error': 'Demasiados intentos. Cuenta bloqueada por 5 minutos.'},
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )
                elif count >= 3:
                    rec['locked_until'] = now + 60   # 1 min
                    return Response(
                        {'error': '3 intentos fallidos. Cuenta bloqueada por 1 minuto.'},
                        status=status.HTTP_429_TOO_MANY_REQUESTS,
                    )
                else:
                    restantes = 3 - count
                    return Response(
                        {'error': f'Credenciales incorrectas. {restantes} intento(s) restante(s) antes del bloqueo.'},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )

        # ── 4. Éxito: emitir JWT ──────────────────────────────────────────────
        _failed[username] = {'count': 0, 'locked_until': 0.0}

        log_action(
            accion='LOGIN', modulo='Cliente' if is_cliente else 'Usuario',
            descripcion=f'{db_username} ({db_role}) inició sesión en el sistema',
            usuario_id=db_id, usuario_nombre=db_username, usuario_rol=db_role,
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        refresh = RefreshToken()
        refresh['user_id'] = db_id
        refresh['username'] = db_username
        refresh['email'] = db_email
        refresh['name'] = db_name
        refresh['role'] = db_role

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': db_id,
                'username': db_username,
                'name': db_name,
                'email': db_email,
                'role': db_role,
                'activo': db_activo,
            }
        })


class LogoutView(APIView):
    """POST /api/v1/users/logout/ — registra el cierre de sesión en la bitácora."""
    permission_classes = [AllowAny]

    def post(self, request):
        actor = actor_from_request(request)
        # Si JWT no fue parseado, usar datos enviados en el body
        if not actor.get('usuario_nombre') or actor.get('usuario_nombre') == 'Anónimo':
            actor = {
                'usuario_id':     request.data.get('usuario_id'),
                'usuario_nombre': request.data.get('usuario_nombre', 'Desconocido'),
                'usuario_rol':    request.data.get('usuario_rol', ''),
                'ip_address':     request.META.get('REMOTE_ADDR'),
            }
        nombre = actor.get('usuario_nombre') or 'Desconocido'
        log_action(
            accion='LOGOUT', modulo='Usuario',
            descripcion=f'{nombre} cerró sesión en el sistema',
            **actor,
        )
        return Response({'detail': 'Sesión cerrada.'})


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer
    permission_classes = []

    def perform_create(self, serializer):
        super().perform_create(serializer)
        actor = actor_from_request(self.request)
        instance = serializer.instance
        log_action(
            accion='CREATE', modulo='Usuario',
            descripcion=f'Se creó el usuario "{instance.nombre_completo}" (username: {instance.username}, rol: {instance.rol})',
            **actor,
        )

    def perform_update(self, serializer):
        super().perform_update(serializer)
        actor = actor_from_request(self.request)
        instance = serializer.instance
        log_action(
            accion='UPDATE', modulo='Usuario',
            descripcion=f'Se modificó el usuario "{instance.nombre_completo}" (ID: {instance.id})',
            **actor,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actor = actor_from_request(request)
        log_action(
            accion='DELETE', modulo='Usuario',
            descripcion=f'Se eliminó el usuario "{instance.nombre_completo}" (username: {instance.username})',
            **actor,
        )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], url_path='update_role')
    def update_role(self, request, pk=None):
        usuario = self.get_object()
        rol = request.data.get('role') or request.data.get('rol')
        valid_roles = ('admin', 'vendedor')
        if rol not in valid_roles:
            return Response(
                {'error': f'Rol inválido. Opciones: {", ".join(valid_roles)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.rol = rol
        usuario.save(update_fields=['rol'])
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=False, methods=['get'])
    def by_role(self, request):
        rol = request.query_params.get('role') or request.query_params.get('rol')
        if not rol:
            return Response({'error': 'role parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        usuarios = Usuario.objects.filter(rol=rol)
        return Response(self.get_serializer(usuarios, many=True).data)


class CheckEmailView(APIView):
    """GET /api/v1/users/check-email/?email=... → {available: true|false}"""
    permission_classes = [AllowAny]

    def get(self, request):
        from django.db import connection
        email = request.query_params.get('email', '').strip().lower()
        if not email:
            return Response({'available': True})
        with connection.cursor() as c:
            c.execute("SELECT 1 FROM usuario WHERE LOWER(email) = %s LIMIT 1", [email])
            en_usuario = c.fetchone() is not None
            c.execute("SELECT 1 FROM cliente WHERE LOWER(correo) = %s LIMIT 1", [email])
            en_cliente = c.fetchone() is not None
        return Response({'available': not (en_usuario or en_cliente)})


class ClienteViewSet(viewsets.ModelViewSet):
    """
    CRUD de clientes. POST /api/v1/users/clientes/ es público (registro).
    """
    queryset           = Cliente.objects.all()
    serializer_class   = ClienteSerializer
    permission_classes = []

    def _actor_cliente(self):
        """Actor dict safe for bitacora: never passes a cliente PK as idusuario (FK violation)."""
        req = self.request
        if req.auth:
            return {
                'usuario_id':     None,  # cliente table != usuario table, FK would fail
                'usuario_nombre': req.auth.get('username') or req.auth.get('name', ''),
                'usuario_rol':    req.auth.get('role', ''),
                'ip_address':     req.META.get('REMOTE_ADDR'),
            }
        return {
            'usuario_id':     None,
            'usuario_nombre': 'Anónimo',
            'usuario_rol':    '',
            'ip_address':     req.META.get('REMOTE_ADDR'),
        }

    def perform_create(self, serializer):
        instance = serializer.save()
        actor = self._actor_cliente()
        nombre = instance.nombre or instance.correo or str(instance.pk)
        log_action(
            accion='CREATE', modulo='Cliente',
            descripcion=f'Nuevo cliente registrado: "{nombre}"',
            **actor,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        actor = self._actor_cliente()
        nombre = instance.nombre or instance.correo or str(instance.pk)
        log_action(
            accion='UPDATE', modulo='Cliente',
            descripcion=f'Se actualizó el perfil del cliente "{nombre}"',
            **actor,
        )

    def perform_destroy(self, instance):
        actor = self._actor_cliente()
        nombre = instance.nombre or instance.correo or str(instance.pk)
        instance.delete()
        log_action(
            accion='DELETE', modulo='Cliente',
            descripcion=f'Se eliminó el cliente "{nombre}"',
            **actor,
        )


class BlockedAccountsView(APIView):
    """GET /api/v1/users/blocked-accounts/ — lista de cuentas con intentos fallidos."""
    permission_classes = [AllowAny]

    def get(self, request):
        result = []
        for username, rec in _failed.items():
            if rec['count'] == 0 and rec['locked_until'] == 0.0:
                continue
            now = __import__('time').time()
            if rec['locked_until'] == float('inf'):
                estado = 'permanent'
            elif rec['locked_until'] > now:
                remaining = int(rec['locked_until'] - now)
                estado = 'temporary_5min' if remaining > 60 else 'temporary_1min'
            else:
                estado = 'unlocked'
            result.append({
                'username': username,
                'failed_attempts': rec['count'],
                'estado': estado,
            })
        return Response(result)


class UnblockAccountView(APIView):
    """POST /api/v1/users/unblock-account/ — desbloquear una cuenta."""
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        if not username:
            return Response({'error': 'username requerido'}, status=status.HTTP_400_BAD_REQUEST)
        _failed[username] = {'count': 0, 'locked_until': 0.0}
        actor = actor_from_request(request)
        log_action(
            accion='UPDATE', modulo='Usuario',
            descripcion=f'Admin desbloqueó la cuenta "{username}"',
            **actor,
        )
        return Response({'message': f'Cuenta "{username}" desbloqueada.'})


class ChangePasswordView(APIView):
    """
    POST /api/v1/users/change-password/
    Body: {"current_password": "...", "new_password": "..."}
    Requires a valid JWT. Works for usuario (admin/employee) and cliente.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.db import connection
        from django.contrib.auth.hashers import check_password as check_pw

        if not request.auth:
            return Response({'error': 'Autenticación requerida.'}, status=status.HTTP_401_UNAUTHORIZED)

        current_password = request.data.get('current_password', '')
        new_password     = request.data.get('new_password', '')

        if not current_password or not new_password:
            return Response({'error': 'Todos los campos son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'error': 'La nueva contraseña debe tener al menos 8 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.auth.get('user_id')
        role    = request.auth.get('role', '')

        if role == 'cliente':
            with connection.cursor() as c:
                c.execute("SELECT password FROM cliente WHERE idcliente = %s LIMIT 1", [user_id])
                row = c.fetchone()
            if not row:
                return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if not check_pw(current_password, row[0]):
                return Response({'error': 'La contraseña actual es incorrecta.'}, status=status.HTTP_400_BAD_REQUEST)
            hashed = make_password(new_password)
            with connection.cursor() as c:
                c.execute("UPDATE cliente SET password = %s WHERE idcliente = %s", [hashed, user_id])
            log_action(
                accion='UPDATE', modulo='Cliente',
                descripcion=f'Cliente ID {user_id} cambió su contraseña',
                usuario_id=None, usuario_nombre=request.auth.get('username', ''),
                usuario_rol=role, ip_address=request.META.get('REMOTE_ADDR'),
            )
        else:
            with connection.cursor() as c:
                c.execute("SELECT password_hash FROM usuario WHERE idusuario = %s LIMIT 1", [user_id])
                row = c.fetchone()
            if not row:
                return Response({'error': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
            if not check_pw(current_password, row[0]):
                return Response({'error': 'La contraseña actual es incorrecta.'}, status=status.HTTP_400_BAD_REQUEST)
            hashed = make_password(new_password)
            with connection.cursor() as c:
                c.execute("UPDATE usuario SET password_hash = %s WHERE idusuario = %s", [hashed, user_id])
            log_action(
                accion='UPDATE', modulo='Usuario',
                descripcion=f'Usuario "{request.auth.get("username", "")}" cambió su contraseña',
                usuario_id=user_id, usuario_nombre=request.auth.get('username', ''),
                usuario_rol=role, ip_address=request.META.get('REMOTE_ADDR'),
            )

        return Response({'message': '¡Contraseña actualizada exitosamente!'})


def _lookup_user_by_identifier(identifier: str):
    """
    Returns (id, email, tabla) tuple if found, else None.
    tabla is 'usuario' or 'cliente'.
    Searches usuario first, then cliente.
    """
    from django.db import connection
    if '@' not in identifier:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT idusuario, email FROM usuario WHERE username = %s AND activo = TRUE LIMIT 1",
                [identifier],
            )
            row = cursor.fetchone()
        if row:
            email = row[1] or ''
            return (row[0], email, 'usuario')
    # Buscar en cliente por usuario_login o correo
    with connection.cursor() as cursor:
        if '@' in identifier:
            cursor.execute(
                "SELECT idcliente, correo FROM cliente WHERE correo = %s LIMIT 1",
                [identifier],
            )
        else:
            cursor.execute(
                "SELECT idcliente, correo FROM cliente WHERE usuario_login = %s LIMIT 1",
                [identifier],
            )
        row = cursor.fetchone()
    if row:
        return (row[0], row[1] or '', 'cliente')
    return None


class ForgotPasswordView(APIView):
    """
    POST /api/v1/users/forgot-password/
    Body: {"identifier": "username_or_email"}
    Always returns 200 to avoid user enumeration.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.db import connection

        identifier = request.data.get('identifier', '').strip()
        if not identifier:
            return Response({'message': 'Si los datos son correctos, recibirás un código en tu correo.'})

        found = _lookup_user_by_identifier(identifier)
        if found is None:
            return Response({'message': 'Si los datos son correctos, recibirás un código en tu correo.'})

        entity_id, email, tabla = found

        if not email:
            return Response({'message': 'Si los datos son correctos, recibirás un código en tu correo.'})

        # Generate 6-character OTP (uppercase letters + digits)
        characters = string.ascii_uppercase + string.digits
        code       = ''.join(random.choices(characters, k=6))
        expires_at = timezone.now() + timedelta(minutes=10)
        _otps[identifier] = {
            'code':      code,
            'expires_at': expires_at,
            'email':     email,
            'entity_id': entity_id,
            'tabla':     tabla,
        }

        subject  = 'Código de recuperación - SantaCruz Computer'
        body_txt = (
            f'Hola,\n\n'
            f'Recibiste este correo porque solicitaste recuperar tu contraseña en SantaCruz Computer.\n\n'
            f'Tu código de verificación es:\n\n'
            f'    {code}\n\n'
            f'Este código es válido por 10 minutos.\n'
            f'Si no solicitaste este cambio, puedes ignorar este mensaje con seguridad.\n\n'
            f'— Equipo SantaCruz Computer'
        )
        try:
            send_mail(
                subject=subject,
                message=body_txt,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f'Failed to send OTP email to {email}: {e}')
            print(f'\n{"="*50}\nOTP para {identifier} ({tabla}): {code}\n{"="*50}\n')

        return Response({'message': 'Si los datos son correctos, recibirás un código en tu correo.'})


class ResetPasswordView(APIView):
    """
    POST /api/v1/users/reset-password/
    Body: {"identifier": "username_or_email", "code": "123456", "new_password": "..."}
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.db import connection

        identifier   = request.data.get('identifier', '').strip()
        code         = request.data.get('code', '').strip()
        new_password = request.data.get('new_password', '')

        if not identifier or not code or not new_password:
            return Response({'error': 'Todos los campos son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'error': 'La contraseña debe tener al menos 8 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)

        # Verificar OTP en memoria
        otp = _otps.get(identifier)
        if not otp or otp['code'] != code or otp['expires_at'] < timezone.now():
            return Response({'error': 'Código inválido o expirado.'}, status=status.HTTP_400_BAD_REQUEST)

        entity_id = otp['entity_id']
        tabla     = otp['tabla']
        hashed    = make_password(new_password)

        with connection.cursor() as cursor:
            if tabla == 'usuario':
                cursor.execute(
                    "UPDATE usuario SET password_hash = %s WHERE idusuario = %s",
                    [hashed, entity_id],
                )
                log_action(
                    accion='RESET_PW', modulo='Usuario',
                    descripcion=f'Se restableció la contraseña del usuario "{identifier}"',
                    usuario_id=entity_id, usuario_nombre='Sistema', usuario_rol='',
                )
            else:
                cursor.execute(
                    "UPDATE cliente SET password = %s WHERE idcliente = %s",
                    [hashed, entity_id],
                )
                log_action(
                    accion='RESET_PW', modulo='Cliente',
                    descripcion=f'Se restableció la contraseña del cliente "{identifier}"',
                    usuario_id=None, usuario_nombre='Sistema', usuario_rol='',
                )

        _otps.pop(identifier, None)
        return Response({'message': '¡Contraseña actualizada exitosamente!'})
