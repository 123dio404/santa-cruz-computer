-- Script de Seguridad para SantaCruz Computer
-- Este script agrega los campos necesarios para el bloqueo de 3 intentos
-- y la recuperación de contraseñas.

-- 1. Asegurarse de que estamos en la tabla correcta
-- Si la tabla 'usuario' no tiene estos campos, los agregamos.

DO $$ 
BEGIN 
    -- Agregar campo para contar intentos fallidos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuario' AND column_name='intentos_fallidos') THEN
        ALTER TABLE usuario ADD COLUMN intentos_fallidos INTEGER DEFAULT 0;
    END IF;

    -- Agregar campo para fecha de bloqueo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuario' AND column_name='bloqueado_hasta') THEN
        ALTER TABLE usuario ADD COLUMN bloqueado_hasta TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Agregar campos para recuperación de contraseña
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuario' AND column_name='token_recuperacion') THEN
        ALTER TABLE usuario ADD COLUMN token_recuperacion VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuario' AND column_name='token_expiracion') THEN
        ALTER TABLE usuario ADD COLUMN token_expiracion TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Asegurar que el campo username sea único y exista (para el login)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='usuario' AND column_name='username') THEN
        ALTER TABLE usuario ADD COLUMN username VARCHAR(50) UNIQUE;
    END IF;
END $$;

-- 2. Crear tabla de Bitácora si no existe
CREATE TABLE IF NOT EXISTS bitacora (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
    username_intento VARCHAR(50),
    accion VARCHAR(50) NOT NULL, -- 'login', 'failed_login', 'logout', 'password_reset'
    descripcion TEXT,
    fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45)
);

-- 3. Tabla para los códigos OTP (opcional, pero buena práctica)
CREATE TABLE IF NOT EXISTS otp_recovery (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuario(id) ON DELETE CASCADE,
    email VARCHAR(100) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
