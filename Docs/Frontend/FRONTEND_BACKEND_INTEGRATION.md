# Integración Frontend — Backend

## Estado actual

| Componente | URL |
|---|---|
| Backend (Django) | http://localhost:8000 |
| Frontend (React) | http://localhost:5173 |
| PostgreSQL | localhost:5432 / Santacruzcomputer |

La integración está **completamente funcional**. Todas las páginas consumen datos reales del backend via `src/app/services/api.ts`.

---

## Cómo funciona api.ts

El archivo `src/app/services/api.ts` centraliza todas las llamadas HTTP.

### Autenticación

```typescript
import { authAPI } from '../services/api';

// Login
const resp = await authAPI.login(username, password);
// resp.access → token JWT
// resp.user → { id, username, role, ... }

// Logout
await authAPI.logout({ usuario_id, usuario_nombre, usuario_rol });
```

### Productos

```typescript
import { productosAPI } from '../services/api';

const productos = await productosAPI.getAll();          // todos
const producto  = await productosAPI.getById(id);       // uno
await productosAPI.create(formData);                    // crear (con imagen)
await productosAPI.update(id, formData);                // editar
await productosAPI.delete(id);                          // eliminar
```

### Ventas

```typescript
import { ventasAPI } from '../services/api';

const ventas   = await ventasAPI.getAll();
const historial = await ventasAPI.getHistorialByVendedor(vendedorId);
await ventasAPI.create({ cliente, detalles, pagos });
await ventasAPI.confirmarEntrega(ventaId);
```

### Compras

```typescript
import { comprasAPI } from '../services/api';

const compras = await comprasAPI.getAll();
await comprasAPI.create({ proveedor, detalles });
```

### Bitácora

```typescript
import { bitacoraAPI } from '../services/api';

const logs = await bitacoraAPI.getAll();
```

---

## Headers de autenticación

Todas las funciones en `api.ts` agregan automáticamente el token:

```typescript
headers: {
  'Authorization': `Bearer ${localStorage.getItem('access_token')}`
}
```

---

## Endpoints principales

| Acción | Método | URL |
|---|---|---|
| Login | POST | `/api/v1/users/login/` |
| Logout | POST | `/api/v1/users/logout/` |
| Productos | GET | `/api/v1/products/?page_size=1000` |
| Crear venta | POST | `/api/v1/orders/ventas/` |
| Confirmar entrega | PATCH | `/api/v1/orders/ventas/<id>/confirmar_entrega/` |
| Factura PDF | GET | `/api/v1/orders/ventas/<id>/pdf/` |
| Compras | GET | `/api/v1/products/compras/` |
| Bitácora | GET | `/api/v1/audit/` |

---

## CORS

El backend permite peticiones desde `http://localhost:5173`. Configurado en `Backend/config/settings.py`.

---

## JWT

- **Access token**: válido 8 horas
- **Refresh token**: válido 7 días
- Se almacenan en `localStorage`
