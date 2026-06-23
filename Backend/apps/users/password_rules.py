"""
password_rules.py — Regla única de complejidad de contraseñas (backend).

Misma política que el frontend (utils/passwordValidation.ts):
  - Mínimo 8 caracteres
  - Al menos una letra mayúscula (A-Z)
  - Al menos una letra minúscula (a-z)
  - Al menos un número (0-9)
  - Al menos un carácter especial

Se usa tanto en los serializers (crear/editar usuario y cliente, incluye el
registro público de clientes) como en los endpoints de cambiar/restablecer
contraseña, para que la validación no se pueda saltar enviando un POST directo.
"""
import re

_ESPECIAL = re.compile(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]')


def password_errores(raw):
    """Devuelve la lista de requisitos que NO cumple la contraseña (vacía = válida)."""
    raw = raw or ''
    faltan = []
    if len(raw) < 8:
        faltan.append('mínimo 8 caracteres')
    if not re.search(r'[A-Z]', raw):
        faltan.append('una letra mayúscula')
    if not re.search(r'[a-z]', raw):
        faltan.append('una letra minúscula')
    if not re.search(r'[0-9]', raw):
        faltan.append('un número')
    if not _ESPECIAL.search(raw):
        faltan.append('un carácter especial')
    return faltan


def password_error_msg(raw):
    """Devuelve un mensaje de error si la contraseña es inválida, o None si es válida."""
    faltan = password_errores(raw)
    if faltan:
        return 'La contraseña debe incluir: ' + ', '.join(faltan) + '.'
    return None
