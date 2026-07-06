-- ============================================================================
-- 009_credito.sql — Venta a crédito + Cartera de créditos (CU28 / CU29)
--
-- Tablas:
--   plan_credito → un plan de financiamiento POR PRODUCTO (cuelga del detalle
--                  de la venta). Guarda el precio financiado, la inicial, las
--                  cuotas y el estado del crédito.
--   cuota        → cada cuota mensual del plan (calendario de pagos).
--
-- Reglas del negocio (el cálculo lo hace el BACKEND antes de insertar):
--   · El crédito es POR PRODUCTO, según su precio unitario:
--       Bs     1 –  5.000  → 6  cuotas, recargo +20%
--       Bs 5.001 – 10.000  → 9  cuotas, recargo +25%
--       Bs 10.001 – 15.000 → 12 cuotas, recargo +30%
--     (fuera de ese rango NO califica a crédito).
--   · precio_financiado = precio_base * (1 + recargo_pct/100)
--   · inicial (enganche) = 20% del precio_financiado — se paga al inicio y se
--     entrega el producto de inmediato.
--   · saldo = precio_financiado - inicial ; monto_cuota = saldo / n_cuotas
--   · Sin interés mensual adicional (el recargo % ya es la ganancia del crédito).
--   · MORA: si una cuota vence sin pago → recargo 10% sobre esa cuota + el
--     cliente queda BLOQUEADO para nuevos créditos (se calcula en el backend:
--     está bloqueado si tiene alguna cuota 'vencida'). No se altera la tabla
--     cliente/usuario.
--
-- Correr este script en el Postgres de RAILWAY (Query), que es la base del backend.
-- ============================================================================

-- 1) Plan de crédito (cuelga del detalle de venta → un plan por producto)
CREATE TABLE IF NOT EXISTS plan_credito (
    idplan            SERIAL PRIMARY KEY,
    idventa           INTEGER NOT NULL REFERENCES venta(idventa),
    iddetalle         INTEGER NOT NULL REFERENCES detalleventa(iddetalle),
    idproducto        INTEGER NOT NULL REFERENCES producto(idproducto),
    idcliente         INTEGER REFERENCES cliente(idcliente),
    idusuario         INTEGER REFERENCES usuario(idusuario),      -- vendedor que lo registró
    precio_unitario   NUMERIC(12,2) NOT NULL DEFAULT 0,           -- precio de lista del producto
    cantidad          INTEGER NOT NULL DEFAULT 1,
    precio_base       NUMERIC(12,2) NOT NULL DEFAULT 0,           -- precio_unitario * cantidad (sin recargo)
    recargo_pct       NUMERIC(5,2)  NOT NULL DEFAULT 0,           -- 20 | 25 | 30
    precio_financiado NUMERIC(12,2) NOT NULL DEFAULT 0,           -- precio_base * (1 + recargo_pct/100)
    inicial           NUMERIC(12,2) NOT NULL DEFAULT 0,           -- 20% del financiado (pagado al inicio)
    n_cuotas          INTEGER NOT NULL DEFAULT 6,                 -- 6 | 9 | 12
    monto_cuota       NUMERIC(12,2) NOT NULL DEFAULT 0,           -- (financiado - inicial) / n_cuotas
    saldo             NUMERIC(12,2) NOT NULL DEFAULT 0,           -- lo que falta cobrar (baja con cada cuota pagada)
    estado            VARCHAR(20) NOT NULL DEFAULT 'vigente',     -- vigente | pagado | moroso
    fecha             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2) Cuotas del plan (calendario de pagos mensuales)
CREATE TABLE IF NOT EXISTS cuota (
    idcuota           SERIAL PRIMARY KEY,
    idplan            INTEGER NOT NULL REFERENCES plan_credito(idplan) ON DELETE CASCADE,
    numero            INTEGER NOT NULL,                           -- 1..n_cuotas
    monto             NUMERIC(12,2) NOT NULL DEFAULT 0,           -- monto base de la cuota
    mora              NUMERIC(12,2) NOT NULL DEFAULT 0,           -- recargo 10% si venció
    fecha_vencimiento DATE NOT NULL,
    fecha_pago        TIMESTAMP,                                  -- NULL mientras esté pendiente
    estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente',   -- pendiente | pagada | vencida
    idusuario_cobro   INTEGER REFERENCES usuario(idusuario)       -- quién registró el pago
);

CREATE INDEX IF NOT EXISTS idx_plan_venta    ON plan_credito(idventa);
CREATE INDEX IF NOT EXISTS idx_plan_cliente  ON plan_credito(idcliente);
CREATE INDEX IF NOT EXISTS idx_plan_estado   ON plan_credito(estado);
CREATE INDEX IF NOT EXISTS idx_cuota_plan    ON cuota(idplan);
CREATE INDEX IF NOT EXISTS idx_cuota_estado  ON cuota(estado);
CREATE INDEX IF NOT EXISTS idx_cuota_venc    ON cuota(fecha_vencimiento);

-- Verificación (opcional):
-- SELECT * FROM plan_credito ORDER BY idplan DESC;
-- SELECT * FROM cuota WHERE idplan = 1 ORDER BY numero;
