-- ============================================================================
-- 004_notificaciones.sql — Centro de notificaciones (CU21)
--
-- Reglas del negocio:
--   1. Cada notificación va dirigida a UN usuario interno (idusuario) O a UN
--      cliente (idcliente). Solo uno de los dos se llena; el otro queda NULL.
--   2. Toda notificación aparece en la campana de la app. Si canal = 'ambos',
--      además se envía por correo (Brevo) al crearla.
--   3. 'leido' arranca en FALSE; se marca TRUE cuando el usuario la abre.
--   4. tipo = etiqueta del evento (venta | reclamo | reclamo_resuelto |
--      bienvenida | resena | ...). Sirve para el ícono/orden en el frontend.
--
-- Aplicar este script UNA SOLA VEZ en local (pgAdmin4) y en Railway:
--   Railway Dashboard -> Postgres -> Query -> pegar y ejecutar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS notificacion (
    idnotificacion  SERIAL PRIMARY KEY,
    idusuario       INTEGER REFERENCES usuario(idusuario) ON DELETE CASCADE,
    idcliente       INTEGER REFERENCES cliente(idcliente) ON DELETE CASCADE,
    tipo            VARCHAR(30)  NOT NULL,                     -- venta | reclamo | reclamo_resuelto | bienvenida | resena ...
    titulo          VARCHAR(150) NOT NULL,
    mensaje         TEXT         NOT NULL,
    enlace          VARCHAR(200),                             -- ruta interna a la que lleva (ej. /warranties)
    canal           VARCHAR(20)  NOT NULL DEFAULT 'sistema',  -- sistema | ambos (ambos = app + correo)
    leido           BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha           TIMESTAMP    NOT NULL DEFAULT NOW(),
    -- Debe apuntar a un usuario O a un cliente (al menos uno)
    CONSTRAINT chk_notif_destinatario CHECK (idusuario IS NOT NULL OR idcliente IS NOT NULL)
);

-- Índices para las consultas más frecuentes (mis notificaciones / no leídas)
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificacion(idusuario);
CREATE INDEX IF NOT EXISTS idx_notif_cliente ON notificacion(idcliente);
CREATE INDEX IF NOT EXISTS idx_notif_leido   ON notificacion(leido);

-- Verificación (opcional):
-- SELECT idnotificacion, idusuario, idcliente, tipo, titulo, leido, fecha
-- FROM notificacion ORDER BY idnotificacion DESC;
