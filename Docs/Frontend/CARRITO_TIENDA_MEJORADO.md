# Tienda Online y Carrito

## Cómo funciona

### Store.tsx

- Carga todos los productos del backend (`productosAPI.getAll()`)
- Filtros disponibles: búsqueda por texto, categoría, marca
- Imágenes con `object-contain` sobre fondo gris claro
- Botón "Agregar al carrito" en cada tarjeta de producto

### Carrito (localStorage)

Los productos se guardan en `localStorage` con la clave `storeCart`:

```typescript
// Guardar al agregar un producto
localStorage.setItem('storeCart', JSON.stringify(cartItems));

// Leer al entrar a Cart.tsx
const savedCart = localStorage.getItem('storeCart');
if (savedCart) setCartItems(JSON.parse(savedCart));
```

El carrito persiste aunque el cliente cierre el navegador o recargue la página.

### Cart.tsx

- Lee el carrito desde `localStorage`
- El cliente puede modificar cantidades o eliminar productos
- Al confirmar el pedido llama:

```typescript
await ventasAPI.create({
  cliente: Number(user.id),
  detalles: cartItems.map(item => ({
    producto: item.product.id,
    cantidad: item.quantity,
    precio_unitario: item.product.price,
  })),
  pagos: [{ monto: total, metodo: metodoPago }],
  pedido_online: true,
});
```

- Después de confirmar, limpia el carrito del `localStorage`

### Orders.tsx

- Muestra el historial de pedidos del cliente autenticado
- Llama `ventasAPI.getByCliente(user.id)`
- El admin/vendedor puede confirmar la entrega desde `SalesHistory.tsx`

## Flujo completo

```
Store.tsx
  → cliente agrega producto → localStorage
  → cliente va a Cart.tsx
  → revisa productos y cantidades
  → selecciona método de pago
  → confirma pedido → POST /api/v1/orders/ventas/
  → carrito se limpia
  → pedido aparece en Orders.tsx
  → admin confirma entrega → estado: completed
```
