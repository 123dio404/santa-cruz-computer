-- ============================================================================
-- 007_servicios_tecnicos.sql — Módulo de Servicio Técnico (CU25/26/27)
--
-- Tablas:
--   servicio_catalogo → los servicios ofrecidos con su precio.
--   orden_servicio    → una orden de servicio (la registra y ejecuta el técnico).
--   orden_detalle     → qué servicios lleva la orden (el correctivo puede llevar varios).
--   tarea_servicio    → checklist del preventivo (marcar lo realizado).
--
-- Reglas:
--   · Preventivo: SOLO para el precio, laptop=200, escritorio=250. GRATIS solo
--     laptops de la tienda con garantía vigente (2 usos, 6 meses de separación).
--   · Correctivo: catálogo fijo, cualquier equipo, se pueden sumar varios.
--   · El control de "2 usos gratis por garantía" se calcula contando las órdenes
--     con es_beneficio de esa idgarantia (no hace falta tabla extra).
--
-- Correr este script en el Postgres de RAILWAY (Query), que es la base del backend.
-- ============================================================================

-- 1) Catálogo de servicios
CREATE TABLE IF NOT EXISTS servicio_catalogo (
    idservicio  SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    tipo        VARCHAR(20)  NOT NULL,               -- preventivo | correctivo
    equipo      VARCHAR(20),                         -- laptop | escritorio (solo preventivo); NULL en correctivo
    precio      NUMERIC(10,2) NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Precios oficiales del negocio (se insertan una sola vez)
INSERT INTO servicio_catalogo (nombre, tipo, equipo, precio) VALUES
  ('Mantenimiento preventivo (Laptop)',                        'preventivo', 'laptop',     200),
  ('Mantenimiento preventivo (Escritorio)',                    'preventivo', 'escritorio', 250),
  ('Eliminación de virus informáticos graves',                 'correctivo', NULL,         100),
  ('Formateo del SO + instalación de programas con licencia',  'correctivo', NULL,         150),
  ('Recuperación de datos (0 a 99 GB)',                        'correctivo', NULL,         300),
  ('Recuperación de datos (100 a 500 GB)',                     'correctivo', NULL,         450),
  ('Recuperación de datos (500 GB a 1 TB)',                    'correctivo', NULL,        1000);

-- 2) Orden de servicio (cabecera). La registra el técnico (crea + ejecuta).
CREATE TABLE IF NOT EXISTS orden_servicio (
    idorden            SERIAL PRIMARY KEY,
    idcliente          INTEGER REFERENCES cliente(idcliente),     -- NULL si es externo
    idtecnico          INTEGER REFERENCES usuario(idusuario),     -- quién registró/atiende
    idgarantia         INTEGER REFERENCES garantia(idgarantia),   -- si preventivo gratis (laptop de la tienda)
    tipo               VARCHAR(20) NOT NULL,                      -- preventivo | correctivo
    origen             VARCHAR(20) NOT NULL DEFAULT 'externo',    -- tienda | externo
    equipo             VARCHAR(20) NOT NULL DEFAULT 'laptop',     -- laptop | escritorio
    equipo_descripcion VARCHAR(200),                              -- marca/modelo/serie (externos)
    es_beneficio       BOOLEAN NOT NULL DEFAULT FALSE,            -- consumió un uso preventivo gratis
    diagnostico        TEXT,
    observaciones      TEXT,
    costo_total        NUMERIC(10,2) NOT NULL DEFAULT 0,
    estado             VARCHAR(20) NOT NULL DEFAULT 'solicitado', -- solicitado|agendado|en_proceso|finalizado|cancelado
    fecha_solicitud    TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_agendada     TIMESTAMP,
    fecha_finalizacion TIMESTAMP
);

-- 3) Servicios incluidos en la orden (para el correctivo puede haber varios)
CREATE TABLE IF NOT EXISTS orden_detalle (
    iddetorden  SERIAL PRIMARY KEY,
    idorden     INTEGER NOT NULL REFERENCES orden_servicio(idorden) ON DELETE CASCADE,
    idservicio  INTEGER NOT NULL REFERENCES servicio_catalogo(idservicio),
    precio      NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- 4) Checklist de tareas (sobre todo del preventivo)
CREATE TABLE IF NOT EXISTS tarea_servicio (
    idtarea     SERIAL PRIMARY KEY,
    idorden     INTEGER NOT NULL REFERENCES orden_servicio(idorden) ON DELETE CASCADE,
    tarea       VARCHAR(150) NOT NULL,
    realizado   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_orden_cliente  ON orden_servicio(idcliente);
CREATE INDEX IF NOT EXISTS idx_orden_tecnico  ON orden_servicio(idtecnico);
CREATE INDEX IF NOT EXISTS idx_orden_estado   ON orden_servicio(estado);
CREATE INDEX IF NOT EXISTS idx_orden_garantia ON orden_servicio(idgarantia);
CREATE INDEX IF NOT EXISTS idx_detorden_orden ON orden_detalle(idorden);
CREATE INDEX IF NOT EXISTS idx_tarea_orden    ON tarea_servicio(idorden);

-- Verificación (opcional):
-- SELECT * FROM servicio_catalogo ORDER BY idservicio;
