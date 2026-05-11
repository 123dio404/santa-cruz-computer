# Documentación Frontend — SantaCruz Computer

## Tecnologías

- React 18 + TypeScript
- Vite (bundler)
- Tailwind CSS (estilos)
- React Router v6 (navegación)
- Recharts (gráficos)
- Lucide React (íconos)
- shadcn/ui (componentes UI)

## Estructura del proyecto

```
Frontend/src/app/
├── context/
│   ├── AuthContext.tsx       → Autenticación global (login, logout, usuario)
│   ├── AuditContext.tsx      → Registro de eventos frontend
│   └── UsersContext.tsx      → Listado de usuarios global
├── components/
│   ├── Layout.tsx            → Sidebar + Header + notificaciones de stock
│   └── ProtectedRoute.tsx    → Protección de rutas por rol
├── pages/
│   ├── Login.tsx             → Login / Registro / Recuperación de contraseña
│   ├── Dashboard.tsx         → Panel principal con métricas y gráficos
│   ├── Products.tsx          → CRUD de productos (admin)
│   ├── Inventory.tsx         → Inventario: almacén, entradas, salidas
│   ├── Sales.tsx             → Punto de venta (POS)
│   ├── SalesHistory.tsx      → Historial de ventas con filtros
│   ├── Users.tsx             → Gestión de usuarios y clientes
│   ├── Suppliers.tsx         → Proveedores, nueva compra, historial
│   ├── Store.tsx             → Tienda online (clientes)
│   ├── Cart.tsx              → Carrito de compras (clientes)
│   ├── Orders.tsx            → Mis pedidos (clientes)
│   ├── AuditLog.tsx          → Bitácora del sistema (admin)
│   └── AdminPanel.tsx        → Reset de contraseñas y seguridad (admin)
├── services/
│   └── api.ts                → Todas las llamadas HTTP al backend
└── routes.tsx                → Definición de rutas y permisos por rol
```

## Roles y acceso por página

| Página | Admin | Vendedor | Cliente |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ❌ |
| Productos | ✅ | ❌ | ❌ |
| Inventario | ✅ | ✅ | ❌ |
| Nueva Venta | ✅ | ✅ | ❌ |
| Historial Ventas | ✅ | ✅ | ❌ |
| Usuarios | ✅ | ❌ | ❌ |
| Proveedores | ✅ | ❌ | ❌ |
| Bitácora | ✅ | ❌ | ❌ |
| Panel Admin | ✅ | ❌ | ❌ |
| Tienda | ❌ | ❌ | ✅ |
| Carrito | ❌ | ❌ | ✅ |
| Mis Pedidos | ❌ | ❌ | ✅ |

## Flujo de autenticación

1. El usuario ingresa usuario y contraseña en `Login.tsx`
2. Se llama `authAPI.login()` → `POST /api/v1/users/login/`
3. El backend retorna `access_token`, `refresh_token` y datos del usuario
4. El token se guarda en `localStorage` con clave `access_token`
5. El usuario se guarda en `localStorage` con clave `user`
6. Se redirige según el rol: `admin` → `/dashboard`, `vendedor` → `/inventory`, `cliente` → `/store`

## Flujo de compra (cliente)

```
Store.tsx → agregar productos al carrito (localStorage: storeCart)
   ↓
Cart.tsx → revisar carrito, confirmar pedido
   ↓
POST /api/v1/orders/ventas/ con pedido_online=true
   ↓
Orders.tsx → ver historial de pedidos
```

## localStorage — claves usadas

| Clave | Contenido |
|---|---|
| `access_token` | JWT de acceso |
| `refresh_token` | JWT de refresco |
| `user` | Datos del usuario autenticado |
| `storeCart` | Carrito de la tienda online |

## Notificaciones de stock bajo

El componente `Layout.tsx` carga productos y ventas cada vez que se monta. Si hay productos con `is_low_stock = true`, muestra una campana con contador y detalle de cada producto afectado (nombre, imagen, stock actual vs mínimo).

## Cómo agregar una nueva página

1. Crear `src/app/pages/MiPagina.tsx`
2. Importar en `routes.tsx`
3. Agregar la ruta con `ProtectedRoute` y `allowedRoles`
4. Agregar ítem al menú en `Layout.tsx` dentro de la lista del rol correspondiente
