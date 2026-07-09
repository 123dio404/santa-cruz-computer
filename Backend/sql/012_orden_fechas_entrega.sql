-- CU25/CU26: Fechas de retiro para servicios técnicos.
--
-- Agrega 2 columnas a orden_servicio para manejar el flujo de retiro:
--   - fecha_entrega_prevista: día en que el cliente puede venir a retirar
--     (lo define el técnico al agendar; le llega al cliente por correo)
--   - fecha_entrega_real: momento exacto en que el cliente efectivamente retiró
--     (se marca cuando el técnico toca "Marcar como entregado")
--
-- El estado "entregado" es un valor nuevo del enum estado (VARCHAR libre),
-- no requiere cambio de esquema, solo empezar a usarlo en el código.

ALTER TABLE orden_servicio
  ADD COLUMN IF NOT EXISTS fecha_entrega_prevista DATE,
  ADD COLUMN IF NOT EXISTS fecha_entrega_real     TIMESTAMP;
