-- ============================================================================
-- 005_devoluciones.sql — Devoluciones (RMA) — CU23
--
-- Reglas del negocio:
--   1. La registra el vendedor/admin en el mostrador; la fila nace ya con su
--      decisión: 'aprobada' o 'rechazada'. NO hay flujo de estados intermedios.
--   2. NUNCA toca detalleventa/factura/pagoventa (integridad del historial).
--   3. El stock del producto vuelve SOLO si la devolución es 'aprobada',
--      una sola vez (trigger AFTER INSERT → sin doble conteo).
--   4. Las validaciones (plazo <= 7 días, no repetido, cantidad <= vendida)
--      van en el backend, antes de insertar.
--
-- Aplicar UNA sola vez en pgAdmin (que apunta a la BD de Railway).
-- ============================================================================

CREATE TABLE IF NOT EXISTS devolucion (
    iddevolucion    SERIAL PRIMARY KEY,
    idventa         INTEGER NOT NULL REFERENCES venta(idventa),
    iddetalle       INTEGER NOT NULL REFERENCES detalleventa(iddetalle),
    idproducto      INTEGER NOT NULL REFERENCES producto(idproducto),
    idcliente       INTEGER REFERENCES cliente(idcliente),
    cantidad        INTEGER NOT NULL DEFAULT 1,
    motivo          TEXT NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'aprobada',  -- aprobada | rechazada
    motivo_rechazo  TEXT,
    monto_reembolso NUMERIC(10,2) NOT NULL DEFAULT 0,
    idusuario       INTEGER REFERENCES usuario(idusuario),    -- quién la registró
    fecha           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devolucion_venta   ON devolucion(idventa);
CREATE INDEX IF NOT EXISTS idx_devolucion_detalle ON devolucion(iddetalle);
CREATE INDEX IF NOT EXISTS idx_devolucion_estado  ON devolucion(estado);

-- Trigger: reingresa stock SOLO si la devolución es 'aprobada'. Como la fila
-- nace final (AFTER INSERT), se dispara una sola vez → sin doble conteo.
CREATE OR REPLACE FUNCTION trg_devolucion_stock() RETURNS trigger AS $func$
BEGIN
    IF NEW.estado = 'aprobada' THEN
        UPDATE producto
           SET stock_fisico = stock_fisico + NEW.cantidad
         WHERE idproducto = NEW.idproducto;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_devolucion_stock ON devolucion;
CREATE TRIGGER trigger_devolucion_stock
    AFTER INSERT ON devolucion
    FOR EACH ROW EXECUTE FUNCTION trg_devolucion_stock();

-- Verificación (opcional):
-- SELECT * FROM devolucion ORDER BY iddevolucion DESC;
