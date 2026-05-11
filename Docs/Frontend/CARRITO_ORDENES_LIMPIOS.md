# Carrito y Pedidos — Comportamiento Actual

## Carrito (Cart.tsx)

El carrito está vacío por defecto para cada cliente. Solo muestra los productos que el cliente agregó desde la tienda.

Los productos se persisten en `localStorage['storeCart']`. Si el cliente cierra el navegador y vuelve, los productos siguen en el carrito hasta que confirme el pedido o limpie el carrito manualmente.

Cuando el cliente confirma el pedido, el carrito se limpia automáticamente.

## Pedidos (Orders.tsx)

Muestra únicamente los pedidos del cliente autenticado, cargados desde el backend:

```typescript
const ventas = await ventasAPI.getByCliente(user.id);
```

Un cliente nuevo que nunca ha comprado verá la pantalla vacía con el mensaje correspondiente.

## Estados de un pedido

| Estado en BD | Significado |
|---|---|
| `pending` | Pedido realizado, pendiente de entrega |
| `completed` | Entrega confirmada por admin/vendedor |

El admin o vendedor confirma la entrega desde `SalesHistory.tsx` usando el botón "Confirmar Entrega", que llama a `PATCH /api/v1/orders/ventas/<id>/confirmar_entrega/`.
