-- ============================================================================
-- 010_checklist_credito.sql — CU28/CU29 refinamiento
--
-- Este script agrega TODO lo que faltaba para el nuevo flujo de venta a crédito:
--   1) Tabla `checklist_credito` 1:1 con `plan_credito` (verificación de
--      documentos según tipo de empleo).
--   2) ALTER `plan_credito`: nuevas columnas `origen` (walk_in | al_credito_sales)
--      y `numero_factura` (correlativo de la factura de la inicial).
--   3) ALTER `cuota`: campos Stripe (checkout online + recuperación de sesión
--      pendiente), método de pago y numero_factura de la cuota.
--   4) SEQUENCE `factura_credito_seq` — correlativo único para las facturas
--      del módulo de crédito (formato final `FCR-2026-000142`).
--
-- Correr este script en el Postgres de RAILWAY (Query).
-- Es IDEMPOTENTE (usa IF NOT EXISTS / IF EXISTS) — se puede correr varias
-- veces sin romper.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tabla checklist_credito (1:1 con plan_credito)
-- ---------------------------------------------------------------------------
-- El vendedor verifica documentos según el tipo de empleo del solicitante.
-- Guardamos qué documentos entregó (boolean por cada uno) + observaciones +
-- fecha de la verificación. Un plan tiene UN checklist (UNIQUE en idplan).

CREATE TABLE IF NOT EXISTS checklist_credito (
    idchecklist            SERIAL PRIMARY KEY,
    idplan                 INTEGER NOT NULL UNIQUE REFERENCES plan_credito(idplan) ON DELETE CASCADE,
    tipo_empleo            VARCHAR(20) NOT NULL,                          -- 'dependiente' | 'independiente'
    antiguedad_meses       INTEGER NOT NULL DEFAULT 0,

    -- Documentos comunes (ambos tipos de empleo)
    ci_solicitante         BOOLEAN NOT NULL DEFAULT FALSE,
    ci_conyuge             BOOLEAN NOT NULL DEFAULT FALSE,
    factura_servicios      BOOLEAN NOT NULL DEFAULT FALSE,                -- luz/agua para domicilio

    -- Documentos solo DEPENDIENTE
    boletas_pago           BOOLEAN NOT NULL DEFAULT FALSE,                -- 3 últimas boletas
    extracto_gestora       BOOLEAN NOT NULL DEFAULT FALSE,                -- AFP / Gestora Pública

    -- Documentos solo INDEPENDIENTE
    facturas_ultimo_ano    BOOLEAN NOT NULL DEFAULT FALSE,
    estados_financieros    BOOLEAN NOT NULL DEFAULT FALSE,
    nit                    BOOLEAN NOT NULL DEFAULT FALSE,
    croquis_domicilio      BOOLEAN NOT NULL DEFAULT FALSE,
    croquis_negocio        BOOLEAN NOT NULL DEFAULT FALSE,
    respaldos_patrimoniales BOOLEAN NOT NULL DEFAULT FALSE,               -- vehículos, inmuebles

    observaciones          TEXT,
    fecha_verificacion     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_plan ON checklist_credito(idplan);

-- ---------------------------------------------------------------------------
-- 2) ALTER plan_credito — origen del plan + número de factura de la inicial
-- ---------------------------------------------------------------------------
-- `origen` distingue si el plan nació desde /sales (metodo pago "Al crédito")
-- o desde /creditos (walk-in con checklist). Sirve para reporting y para
-- decidir si se muestra el checklist en la vista del plan.
-- `numero_factura` es la factura que se emite al cobrar la INICIAL.

ALTER TABLE plan_credito
    ADD COLUMN IF NOT EXISTS origen         VARCHAR(20),  -- 'walk_in' | 'al_credito_sales'
    ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(20);  -- ej. 'FCR-2026-000142'

-- ---------------------------------------------------------------------------
-- 3) ALTER cuota — Stripe + método de pago + factura de la cuota
-- ---------------------------------------------------------------------------
-- `stripe_payment_intent_id`   → PaymentIntent de la cuota YA pagada (auditoría)
-- `stripe_session_pending`     → CheckoutSession iniciada por el cliente pero
--                                no confirmada (por si cerró la pestaña) — el
--                                botón "¿Ya pagaste? Verificar" en Mis Créditos
--                                usa este campo para consultar a Stripe y
--                                marcar la cuota como pagada de forma idempotente.
-- `metodo_pago`                → 'efectivo' (presencial) | 'stripe' (online)
-- `numero_factura`             → factura emitida al pagar la cuota

ALTER TABLE cuota
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS stripe_session_pending   VARCHAR(120),
    ADD COLUMN IF NOT EXISTS metodo_pago              VARCHAR(20),
    ADD COLUMN IF NOT EXISTS numero_factura           VARCHAR(20);

-- ---------------------------------------------------------------------------
-- 4) SEQUENCE para el correlativo de facturas del módulo crédito
-- ---------------------------------------------------------------------------
-- Genera un entero incremental por cada factura emitida (inicial + cuotas).
-- El backend lo formatea como 'FCR-{año}-{correlativo:06d}'.

CREATE SEQUENCE IF NOT EXISTS factura_credito_seq
    START WITH 1
    INCREMENT BY 1
    NO MAXVALUE
    NO MINVALUE
    CACHE 1;

-- Verificación (opcional):
-- SELECT * FROM checklist_credito LIMIT 5;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='plan_credito';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='cuota';
-- SELECT nextval('factura_credito_seq'); -- devuelve 1 la primera vez
