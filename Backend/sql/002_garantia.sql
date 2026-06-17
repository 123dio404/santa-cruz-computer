-- ============================================================================
-- 002_garantia.sql — Gestión de Garantías de productos vendidos
--
-- Reglas del negocio:
--   1. Cada producto tiene una duración de garantía en MESES (producto.meses_garantia).
--      Ej: disco duro 3, audífonos 6, laptop 12. Valor 0 = sin garantía.
--   2. La garantía empieza a contar el día de la VENTA (fecha_inicio = fecha_venta)
--      y vence en fecha_inicio + meses (fecha_fin).
--   3. Se genera 1 garantía por cada ítem (detalleventa) de la venta cuyo
--      producto tenga meses_garantia > 0.
--   4. Estados:
--        activa     → vigente o vencida (se calcula por fecha al leer)
--        reclamada  → el cliente reportó un problema (en revisión)
--        aprobada   → el reclamo procede (se cubre)
--        rechazada  → no procede (manipulación / mal uso) → NO se puede re-reclamar
--   5. "Vencida" NO se guarda: se calcula con fecha_fin < hoy. Así no hace falta
--      ninguna tarea programada que actualice estados.
--
-- Aplicar este script UNA SOLA VEZ en local y en Railway:
--   Railway Dashboard -> Postgres -> Data -> Query -> pegar y ejecutar.
-- ============================================================================

-- 1) Duración de garantía por producto (en meses). 0 = sin garantía.
ALTER TABLE producto
  ADD COLUMN IF NOT EXISTS meses_garantia INTEGER NOT NULL DEFAULT 0;

-- 2) Tabla de garantías
CREATE TABLE IF NOT EXISTS garantia (
    idgarantia       SERIAL PRIMARY KEY,
    idventa          INTEGER NOT NULL REFERENCES venta(idventa) ON DELETE CASCADE,
    iddetalle        INTEGER NOT NULL UNIQUE REFERENCES detalleventa(iddetalle) ON DELETE CASCADE,
    idproducto       INTEGER NOT NULL REFERENCES producto(idproducto),
    idcliente        INTEGER REFERENCES cliente(idcliente),
    cantidad         INTEGER NOT NULL DEFAULT 1,
    meses            INTEGER NOT NULL DEFAULT 0,
    fecha_inicio     DATE NOT NULL,
    fecha_fin        DATE NOT NULL,
    estado           VARCHAR(20) NOT NULL DEFAULT 'activa',
    motivo_reclamo   TEXT,
    fecha_reclamo    TIMESTAMP,
    resolucion       TEXT,
    fecha_resolucion TIMESTAMP
);

-- Índices para las consultas más frecuentes (por cliente y por estado)
CREATE INDEX IF NOT EXISTS idx_garantia_cliente ON garantia(idcliente);
CREATE INDEX IF NOT EXISTS idx_garantia_estado  ON garantia(estado);
CREATE INDEX IF NOT EXISTS idx_garantia_venta    ON garantia(idventa);

-- 3) (OPCIONAL) Garantías retroactivas de ventas ya existentes.
--    NO ejecutes esto todavía: primero pon los meses a cada producto y luego
--    usa el botón "Generar garantías de ventas anteriores" en la app
--    (hace exactamente este INSERT, contando desde la fecha real de cada venta).
--    Se deja aquí como referencia / alternativa manual:
--
-- INSERT INTO garantia (idventa, iddetalle, idproducto, idcliente, cantidad,
--                       meses, fecha_inicio, fecha_fin, estado)
-- SELECT v.idventa, d.iddetalle, d.idproducto, v.idcliente, d.cantidad,
--        p.meses_garantia,
--        v.fecha_venta::date,
--        (v.fecha_venta::date + (p.meses_garantia || ' months')::interval)::date,
--        'activa'
-- FROM detalleventa d
-- JOIN venta v    ON v.idventa = d.idventa
-- JOIN producto p ON p.idproducto = d.idproducto
-- WHERE p.meses_garantia > 0
--   AND NOT EXISTS (SELECT 1 FROM garantia g WHERE g.iddetalle = d.iddetalle);

-- 4) Verificación (opcional):
-- SELECT g.idgarantia, g.idventa, p.nombre, g.fecha_inicio, g.fecha_fin, g.estado
-- FROM garantia g JOIN producto p ON p.idproducto = g.idproducto
-- ORDER BY g.idgarantia DESC;
