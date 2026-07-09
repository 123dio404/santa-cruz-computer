-- ============================================================================
-- 013_orden_producto_referencia.sql — CU25/CU26 refinamiento
--
-- Agrega el vínculo opcional entre una orden de servicio y un producto del
-- catálogo, sirviendo como REFERENCIA de modelo:
--
--   • Cuando el equipo lo compró el cliente en nuestra tienda, guardamos el
--     producto exacto para poder cruzarlo con su garantía (usos GRATIS).
--   • Cuando el cliente trae un equipo externo (no comprado acá), guardamos
--     el mismo producto del catálogo como REFERENCIA de modelo — porque
--     muchas tiendas venden los mismos modelos (ej: MSI Bravo 15). Así el
--     técnico busca en el catálogo en vez de escribir el modelo a mano.
--
-- Con este vínculo se puede sacar historial por modelo:
--   "al MSI Bravo 15 le hicimos 8 servicios: 5 propios, 3 externos"
--
-- Nullable + ON DELETE SET NULL — las órdenes viejas no rompen y si el
-- producto se borra la orden queda huérfana pero sigue funcionando.
--
-- Correr este script en el Postgres de RAILWAY (Query).
-- Idempotente: se puede correr varias veces sin romper.
-- ============================================================================

ALTER TABLE orden_servicio
    ADD COLUMN IF NOT EXISTS idproducto_referencia INTEGER
    REFERENCES producto(idproducto) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orden_producto_ref ON orden_servicio(idproducto_referencia);

-- Verificación (opcional):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name='orden_servicio' AND column_name='idproducto_referencia';
