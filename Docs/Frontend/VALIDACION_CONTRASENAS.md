# Validación de Contraseñas

## Requisitos actuales

Las contraseñas deben cumplir:

- Mínimo 8 caracteres
- Al menos una letra mayúscula (A-Z)
- Al menos una letra minúscula (a-z)
- Al menos un número (0-9)

Los caracteres especiales son opcionales pero suman fortaleza.

## Dónde se valida

### Frontend (`src/app/utils/passwordValidation.ts`)

La función `validatePassword()` verifica los requisitos y retorna:
- `isValid: boolean`
- `errors: string[]` — lista de requisitos no cumplidos
- `strength: number` — nivel de 0 a 4

Se usa en `Login.tsx` en los formularios de registro y recuperación de contraseña. El indicador visual de fortaleza se muestra en tiempo real mientras el usuario escribe.

### Backend (`apps/users/views.py`)

La contraseña se hashea con `django.contrib.auth.hashers.make_password` antes de guardarse. El hash se almacena en `usuario.password_hash` o `cliente.password`.

## Recuperación de contraseña

1. El usuario ingresa su nombre de usuario en "Olvidé mi contraseña"
2. El backend genera un código OTP de 6 dígitos y lo envía por email
3. El OTP es válido por 10 minutos
4. El usuario ingresa el código y su nueva contraseña
5. Si el código es válido, se actualiza la contraseña en la BD
6. El OTP queda marcado como usado

## Reset por administrador

El admin puede restablecer contraseñas desde `AdminPanel.tsx`:
- Buscar al usuario por nombre
- Ingresar la nueva contraseña
- El backend actualiza `password_hash` y registra la acción en la bitácora

## Seguridad de la sesión

- Bloqueo temporal tras 3 intentos fallidos (1 minuto)
- Bloqueo extendido tras 6 intentos (5 minutos)
- Bloqueo permanente tras más de 6 intentos (requiere intervención del admin)
