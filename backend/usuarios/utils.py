import re
import secrets
import string
from django.utils import timezone
from datetime import timedelta

def validar_complejidad_password(password):
    """
    Verifica que la contraseña tenga:
    - Al menos 8 caracteres
    - Al menos una mayúscula
    - Al menos una minúscula
    - Al menos un número
    """
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r'[A-Z]', password):
        return False, "La contraseña debe tener al menos una letra mayúscula."
    if not re.search(r'[a-z]', password):
        return False, "La contraseña debe tener al menos una letra minúscula."
    if not re.search(r'[0-9]', password):
        return False, "La contraseña debe tener al menos un número."
    return True, ""

def generar_token_recuperacion():
    """Genera un token alfanumérico aleatorio de 6 caracteres."""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
