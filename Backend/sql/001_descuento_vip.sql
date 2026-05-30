-- ============================================================================
-- 001_descuento_vip.sql — Descuento VIP para clientes fieles
--
-- Reglas:
--   1. Por cada 10000 Bs acumulados en compras, el cliente gana 200 Bs de descuento.
--   2. El descuento se aplica en la SIGUIENTE compra (no en la que cruza el umbral).
--   3. Se aplica en bloques de 200 Bs, tantos como caben en la compra.
--   4. El acumulado suma el monto ANTES del descuento (rewardea la lealtad real).
--   5. Compra >= bloque exacto: cliente puede pagar 0 (regla relajada).
--
-- Aplicar este script en la base de datos de Railway (una sola vez):
--   - Railway Dashboard -> Postgres -> Data -> Query -> pegar y ejecutar
-- ============================================================================

-- 1) Agregar columnas a la tabla cliente
ALTER TABLE cliente
  ADD COLUMN IF NOT EXISTS total_acumulado DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_disponible DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 2) Agregar columna a la tabla venta
ALTER TABLE venta
  ADD COLUMN IF NOT EXISTS descuento_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 3) Retroactivo: poblar total_acumulado con la suma historica de ventas de cada cliente
UPDATE cliente c
SET total_acumulado = COALESCE((
    SELECT SUM(v.monto_total)
    FROM venta v
    WHERE v.idcliente = c.idcliente
), 0);

-- 4) Retroactivo: otorgar 200 Bs por cada 10000 Bs acumulados (clientes fieles)
UPDATE cliente
SET descuento_disponible = FLOOR(total_acumulado / 10000) * 200;

-- 5) Verificacion (opcional): ver clientes VIP
-- SELECT idcliente, nombre, apellido, total_acumulado, descuento_disponible
-- FROM cliente
-- WHERE total_acumulado >= 10000
-- ORDER BY total_acumulado DESC;
