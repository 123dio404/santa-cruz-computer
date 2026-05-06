import random
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

from .models import Usuario
from .serializers import UsuarioSerializer
from apps.audit.utils import log_action, actor_from_request

# In-memory block tracker: email → {count, locked_until}
# Resets when the server restarts (acceptable for a demo/dev environment)
_failed: dict = defaultdict(lambda: {'count': 0, 'locked_until': 0.0})


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

        # ── Lookup user via raw SQL (bypass ORM field-mapping issues) ─────────
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT id, username, name, email, role, telefono, activo, password_hash "
                    "FROM usuario WHERE username = %s LIMIT 1",
                    [username]
                )
                row = cursor.fetchone()
        except Exception as e:
            return Response(
                {'error': f'Error de base de datos: {type(e).__name__}: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if row is None:
            return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)

        db_id, db_username, db_name, db_email, db_role, db_telefono, db_activo, db_password_hash = row

        # ── Password check ────────────────────────────────────────────────────
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

        # ── Success: reset counter, issue JWT ─────────────────────────────────
        _failed[username] = {'count': 0, 'locked_until': 0.0}

        log_action(
            accion='LOGIN', modulo='Usuario',
            descripcion=f'{db_name} ({db_role}) inició sesión en el sistema',
            usuario_id=db_id, usuario_nombre=db_name, usuario_rol=db_role,
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
                'telefono': db_telefono,
                'activo': db_activo,
            }
        })


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
            descripcion=f'Se creó el usuario "{instance.name}" (username: {instance.username}, rol: {instance.role})',
            **actor,
        )

    def perform_update(self, serializer):
        super().perform_update(serializer)
        actor = actor_from_request(self.request)
        instance = serializer.instance
        log_action(
            accion='UPDATE', modulo='Usuario',
            descripcion=f'Se modificó el usuario "{instance.name}" (ID: {instance.id})',
            **actor,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        actor = actor_from_request(request)
        log_action(
            accion='DELETE', modulo='Usuario',
            descripcion=f'Se eliminó el usuario "{instance.name}" (username: {instance.username})',
            **actor,
        )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['patch'], url_path='update_role')
    def update_role(self, request, pk=None):
        """PATCH /api/v1/users/users/{id}/update_role/  Body: {"role": "admin|vendedor|cliente"}"""
        usuario = self.get_object()
        role = request.data.get('role')
        valid_roles = ('admin', 'vendedor', 'cliente')
        if role not in valid_roles:
            return Response(
                {'error': f'Rol inválido. Opciones: {", ".join(valid_roles)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        usuario.role = role
        usuario.save(update_fields=['role'])
        return Response(UsuarioSerializer(usuario).data)

    @action(detail=False, methods=['get'])
    def by_role(self, request):
        """GET /api/v1/users/users/by_role/?role=cliente"""
        role = request.query_params.get('role')
        if not role:
            return Response({'error': 'role parameter is required'}, status=status.HTTP_400_BAD_REQUEST)
        usuarios = Usuario.objects.filter(role=role)
        serializer = self.get_serializer(usuarios, many=True)
        return Response(serializer.data)


def _lookup_user_by_identifier(identifier: str):
    """
    Returns (id, email) tuple if user found, else None.
    Detects email vs username by presence of '@'.
    Uses raw SQL to bypass managed=False ORM limitations.
    """
    from django.db import connection
    field = 'email' if '@' in identifier else 'username'
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT id, email FROM usuario WHERE {field} = %s AND activo = TRUE LIMIT 1",
            [identifier],
        )
        return cursor.fetchone()  # (id, email) or None


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

        row = _lookup_user_by_identifier(identifier)
        if row is None:
            # Security: do not reveal whether user exists
            return Response({'message': 'Si los datos son correctos, recibirás un código en tu correo.'})

        usuario_id, email = row

        # Delete previous unused OTPs for this user
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM otp_recovery WHERE usuario_id = %s AND used = FALSE",
                [usuario_id],
            )

        # Generate 6-digit OTP
        code       = str(random.randint(100000, 999999))
        expires_at = timezone.now() + timedelta(minutes=10)

        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO otp_recovery (usuario_id, email, code, expires_at, used, created_at) "
                "VALUES (%s, %s, %s, %s, FALSE, NOW())",
                [usuario_id, email, code, expires_at],
            )

        # Send email
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
            # In dev, print so the developer can still use the code
            print(f'\n{"="*50}\nOTP para {email}: {code}\n{"="*50}\n')

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

        row = _lookup_user_by_identifier(identifier)
        if row is None:
            return Response({'error': 'Código inválido o expirado.'}, status=status.HTTP_400_BAD_REQUEST)

        usuario_id, email = row

        # Find valid OTP
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM otp_recovery "
                "WHERE usuario_id = %s AND code = %s AND used = FALSE AND expires_at > NOW() "
                "LIMIT 1",
                [usuario_id, code],
            )
            otp_row = cursor.fetchone()

        if otp_row is None:
            return Response({'error': 'Código inválido o expirado.'}, status=status.HTTP_400_BAD_REQUEST)

        otp_id = otp_row[0]

        # Update password
        hashed = make_password(new_password)
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE usuario SET password_hash = %s WHERE id = %s",
                [hashed, usuario_id],
            )
            # Mark OTP as used
            cursor.execute(
                "UPDATE otp_recovery SET used = TRUE WHERE id = %s",
                [otp_id],
            )

        log_action(
            accion='RESET_PW', modulo='Usuario',
            descripcion=f'Se restableció la contraseña del usuario con ID {usuario_id}',
            usuario_id=usuario_id, usuario_nombre='Sistema', usuario_rol='',
        )

        return Response({'message': '¡Contraseña actualizada exitosamente!'})
