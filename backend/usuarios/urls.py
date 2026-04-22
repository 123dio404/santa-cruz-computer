from django.urls import path
from .views import login_view, register_view, logout_view, forgot_password_view, reset_password_view

urlpatterns = [
    path('login/', login_view, name='login'),
    path('register/', register_view, name='register'),
    path('logout/', logout_view, name='logout'),
    path('forgot-password/', forgot_password_view, name='forgot-password'),
    path('reset-password/', reset_password_view, name='reset-password'),
]
