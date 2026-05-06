from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UsuarioViewSet, LoginView, ForgotPasswordView, ResetPasswordView

router = DefaultRouter()
router.register(r'', UsuarioViewSet, basename='user')

urlpatterns = [
    path('login/',           LoginView.as_view(),          name='login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/',  ResetPasswordView.as_view(),  name='reset-password'),
    path('', include(router.urls)),
]
