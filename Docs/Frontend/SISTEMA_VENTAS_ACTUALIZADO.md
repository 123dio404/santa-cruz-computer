# Sistema de Ventas

## Módulos involucrados

| Página | Rol | Función |
|---|---|---|
| `Sales.tsx` | Admin / Vendedor | Punto de venta presencial |
| `SalesHistory.tsx` | Admin / Vendedor | Historial y confirmación de entregas |
| `Cart.tsx` | Cliente | Pedido online |
| `Orders.tsx` | Cliente | Ver mis pedidos |

---

## Sales.tsx — Punto de Venta

1. El vendedor selecciona cliente (opcional), productos y cantidades
2. Selecciona método de pago: Efectivo, Tarjeta o QR
3. Al confirmar llama `POST /api/v1/orders/ventas/` con detalles y pago
4. El stock se actualiza automáticamente en la BD (trigger)
5. Se puede generar la factura PDF desde `SalesHistory.tsx`

## SalesHistory.tsx — Historial

- **Tab "Todas"**: muestra todas las ventas del sistema (admin) o del vendedor (empleado)
- **Tab "Clientes"**: permite filtrar ventas por cliente específico
- Cada venta es expandible para ver productos, pagos y detalles
- Botón "Confirmar Entrega" disponible para ventas en estado `pending`
- Botón "Ver Factura PDF" disponible para ventas completadas

## Flujo de venta presencial

```
Sales.tsx
  → seleccionar productos
  → seleccionar método de pago
  → POST /api/v1/orders/ventas/
  → venta creada con estado "pending"
  → confirmar entrega desde SalesHistory.tsx
  → PATCH /api/v1/orders/ventas/<id>/confirmar_entrega/
  → estado cambia a "completed"
  → factura disponible en GET /api/v1/orders/ventas/<id>/pdf/
```

## Factura PDF

- Se genera bajo demanda desde el botón en `SalesHistory.tsx`
- El backend crea o recupera el registro `Factura` automáticamente (idempotente)
- Incluye: datos del negocio, cliente, productos, pagos, estado SIAT
- Nombre del archivo: `factura-XXXX.pdf`

## Validaciones de stock

El backend valida stock antes de crear la venta. Si no hay suficiente stock, retorna error 400 con el mensaje correspondiente. El frontend muestra este mensaje al usuario.

## Métodos de pago

| Frontend | Backend |
|---|---|
| Efectivo | `efectivo` |
| Tarjeta | `tarjeta` |
| QR / Transferencia | `transferencia` |
