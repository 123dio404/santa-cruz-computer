-- ============================================================================
-- 008_rol_tecnico.sql — Permitir el rol 'tecnico' en la tabla usuario (CU25/26/27)
--
-- La tabla usuario tiene un CHECK que limitaba rol a ('admin','vendedor').
-- Se amplía para incluir 'tecnico'. Correr en el Postgres de Railway (Query).
-- ============================================================================

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_rol_check;
ALTER TABLE usuario ADD CONSTRAINT usuario_rol_check
    CHECK (rol IN ('admin', 'vendedor', 'tecnico'));
