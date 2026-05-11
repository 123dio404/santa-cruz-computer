# Estado del Sistema — Integración Completada

## Componentes activos

| Componente | URL | Estado |
|---|---|---|
| Backend Django | http://localhost:8000 | Activo |
| Frontend React | http://localhost:5173 | Activo |
| PostgreSQL | localhost:5432 / Santacruzcomputer | Activo |

---

## Backend — Endpoints activos

- `POST /api/v1/users/login/` — autenticación JWT
- `POST /api/v1/users/logout/` — cierre de sesión con log
- `POST /api/v1/users/forgot-password/` — OTP por email
- `POST /api/v1/users/reset-password/` — restablecer contraseña
- CRUD completo: usuarios, clientes, productos, categorías, proveedores, compras, ventas, pagos
- `GET /api/v1/orders/ventas/<id>/pdf/` — factura PDF
- `GET /api/v1/audit/` — bitácora del sistema

---

## Frontend — Páginas activas

| Página | Ruta | Rol |
|---|---|---|
| Login | `/login` | Público |
| Dashboard | `/dashboard` | Admin, Vendedor |
| Productos | `/products` | Admin |
| Inventario | `/inventory` | Admin, Vendedor |
| Nueva Venta | `/sales` | Admin, Vendedor |
| Historial Ventas | `/sales-history` | Admin, Vendedor |
| Usuarios | `/users` | Admin |
| Proveedores | `/suppliers` | Admin |
| Bitácora | `/audit-log` | Admin |
| Panel Admin | `/admin-panel` | Admin |
| Tienda | `/store` | Cliente |
| Carrito | `/cart` | Cliente |
| Mis Pedidos | `/orders` | Cliente |

---

## Funcionalidades implementadas

- Login con JWT y control de intentos fallidos
- Recuperación de contraseña por OTP via email
- CRUD de productos con imagen, descripción, categoría, marca
- Control de stock: entrada por compras, salida por ventas
- Ventas presenciales (POS) y pedidos online
- Factura PDF generada y guardada en BD
- Historial de compras con filtro de fechas y total acumulado
- Bitácora de auditoría con todas las acciones del sistema
- Notificaciones de stock bajo en el header
- Gestión de usuarios y clientes con registro en bitácora

---

## Notas técnicas

- `managed = False` en todos los modelos — Django no toca la BD
- Triggers de PostgreSQL gestionan totales y stock automáticamente
- Paginación flexible: `?page_size=10000` para obtener todos los registros
- `bitacora.idusuario` es FK a `usuario` — clientes se registran con `usuario_id=None`
- Access token expira en 8 horas, refresh token en 7 días
