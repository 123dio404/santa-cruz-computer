"""
urls.py — Rutas del módulo de Usuarios

Todas las URLs de este archivo tienen el prefijo /api/v1/users/ (definido en config/urls.py).

ENDPOINTS DISPONIBLES:
  POST   /api/v1/users/login/            → Iniciar sesión (devuelve JWT)
  POST   /api/v1/users/logout/           → Cerrar sesión (registra en bitácora)
  GET    /api/v1/users/check-email/      → Verificar si un email ya está registrado
  POST   /api/v1/users/forgot-password/  → Solicitar código OTP para recuperar contraseña
  POST   /api/v1/users/reset-password/   → Verificar OTP y cambiar contraseña
  POST   /api/v1/users/change-password/  → Cambiar contraseña (usuario logueado)
  GET    /api/v1/users/blocked-accounts/ → Ver cuentas con intentos fallidos (admin)
  POST   /api/v1/users/unblock-account/  → Desbloquear una cuenta (admin)

  GET/POST /api/v1/users/clientes/       → Listar o crear clientes
  GET/PATCH/DELETE /api/v1/users/clientes/{id}/ → Detalle/editar/eliminar cliente

  GET/POST /api/v1/users/               → Listar o crear usuarios
  GET/PATCH/DELETE /api/v1/users/{id}/  → Detalle/editar/eliminar usuario
  PATCH /api/v1/users/{id}/update_role/ → Cambiar rol de un usuario
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet, ClienteViewSet, LoginView, LogoutView, ForgotPasswordView, ResetPasswordView, CheckEmailView, ChangePasswordView, BlockedAccountsView, UnblockAccountView, NotificacionesView, NotificacionLeerView

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'',         UsuarioViewSet, basename='user')

urlpatterns = [
    path('login/',           LoginView.as_view(),          name='login'),
    path('logout/',          LogoutView.as_view(),         name='logout'),
    path('check-email/',     CheckEmailView.as_view(),     name='check-email'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/',  ResetPasswordView.as_view(),  name='reset-password'),
    path('change-password/',    ChangePasswordView.as_view(),    name='change-password'),
    path('blocked-accounts/',   BlockedAccountsView.as_view(),   name='blocked-accounts'),
    path('unblock-account/',    UnblockAccountView.as_view(),    name='unblock-account'),
    # CU21 — Notificaciones (van ANTES del router para que no las capture su ruta genérica)
    path('notificaciones/',               NotificacionesView.as_view(), name='notificaciones'),
    path('notificaciones/marcar-leidas/', NotificacionLeerView.as_view(), name='notificaciones-leer'),
    path('', include(router.urls)),
]
