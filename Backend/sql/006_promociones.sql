-- ============================================================================
-- 006_promociones.sql — Promociones programadas por producto (CU24)
--
-- Reglas del negocio:
--   1. El admin define un descuento (%) sobre UN producto, con fecha de inicio y fin.
--   2. La promoción está "vigente" cuando hoy está entre fecha_inicio y fecha_fin
--      (y activo = TRUE). El precio con descuento se muestra y se cobra.
--   3. porcentaje: 1 a 100. Distinto del descuento VIP por fidelidad (ese ya existe).
--
-- IMPORTANTE: correr este script en el Postgres de Railway (Query), que es la
-- base que usa el backend desplegado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promocion (
    idpromocion   SERIAL PRIMARY KEY,
    idproducto    INTEGER NOT NULL REFERENCES producto(idproducto) ON DELETE CASCADE,
    porcentaje    NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
    fecha_inicio  DATE NOT NULL,
    fecha_fin     DATE NOT NULL,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_promo_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_promo_producto ON promocion(idproducto);
CREATE INDEX IF NOT EXISTS idx_promo_activo   ON promocion(activo);

-- Verificación (opcional):
-- SELECT * FROM promocion ORDER BY idpromocion DESC;
