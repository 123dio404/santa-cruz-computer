-- CU23: Persistir el checklist de inspección física de cada devolución.
-- Se separa "Sin daño ni manipulación" en 2 booleans independientes para que
-- el sistema decida automáticamente si la garantía debe anularse al rechazar
-- (rechazo por daño o por manipulación anula garantía; otros motivos no).
--
-- Devoluciones existentes: quedan con FALSE en los 4 (no se re-evalúan hacia
-- atrás porque el negocio real no lo requiere).

ALTER TABLE devolucion
  ADD COLUMN IF NOT EXISTS insp_sin_dano         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insp_sin_manipulacion BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insp_mismo_producto   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insp_completo         BOOLEAN NOT NULL DEFAULT FALSE;
