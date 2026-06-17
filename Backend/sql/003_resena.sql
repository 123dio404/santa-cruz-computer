-- ============================================================================
-- 003_resena.sql — Reseñas de la tienda (opiniones de clientes)
--
-- Reglas del negocio:
--   1. La reseña es por VENTA completa (el pedido entero), no por producto.
--      Califica la experiencia: atención + calidad del/los producto(s).
--   2. Solo el cliente dueño de una venta COMPLETADA puede reseñarla.
--   3. 1 reseña por venta (UNIQUE idventa). Una vez enviada NO se edita ni se
--      borra por el cliente (queda fija).
--   4. puntuacion 1..5 obligatoria; comentario opcional.
--   5. Moderación: el admin puede OCULTAR una reseña (estado='oculto'); las
--      ocultas no se muestran en la Tienda ni cuentan en el promedio, pero el
--      registro se conserva (reversible con 'visible').
--
-- Aplicar este script UNA SOLA VEZ en local y en Railway:
--   Railway Dashboard -> Postgres -> Data -> Query -> pegar y ejecutar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS resena (
    idresena    SERIAL PRIMARY KEY,
    idventa     INTEGER NOT NULL UNIQUE REFERENCES venta(idventa) ON DELETE CASCADE,
    idcliente   INTEGER NOT NULL REFERENCES cliente(idcliente) ON DELETE CASCADE,
    puntuacion  SMALLINT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
    comentario  TEXT,
    estado      VARCHAR(20) NOT NULL DEFAULT 'visible',  -- visible | oculto
    fecha       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resena_estado  ON resena(estado);
CREATE INDEX IF NOT EXISTS idx_resena_cliente ON resena(idcliente);

-- Verificación (opcional):
-- SELECT r.idresena, r.idventa, c.nombre, r.puntuacion, r.estado, r.fecha
-- FROM resena r JOIN cliente c ON c.idcliente = r.idcliente
-- ORDER BY r.idresena DESC;
