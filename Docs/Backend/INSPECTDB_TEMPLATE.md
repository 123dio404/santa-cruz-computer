# Endpoints API — Referencia Completa

Base URL: `http://localhost:8000/api/v1`

Todos los endpoints excepto login requieren header:
```
Authorization: Bearer <access_token>
```

---

## Usuarios — `/api/v1/users/`

| Método | URL | Descripción |
|---|---|---|
| POST | `/users/login/` | Login (retorna JWT + datos del usuario) |
| POST | `/users/logout/` | Logout (registra en bitácora) |
| GET | `/users/check-email/?email=` | Verificar disponibilidad de email |
| POST | `/users/forgot-password/` | Solicitar código OTP por email |
| POST | `/users/reset-password/` | Restablecer contraseña con OTP |
| GET | `/users/` | Listar usuarios |
| POST | `/users/` | Crear usuario |
| PATCH | `/users/<id>/` | Editar usuario |
| DELETE | `/users/<id>/` | Eliminar usuario |
| PATCH | `/users/<id>/update_role/` | Cambiar rol (`admin` o `vendedor`) |
| GET | `/users/by_role/?role=vendedor` | Filtrar por rol |
| GET | `/users/clientes/` | Listar clientes |
| POST | `/users/clientes/` | Registrar cliente |
| PATCH | `/users/clientes/<id>/` | Editar cliente |
| DELETE | `/users/clientes/<id>/` | Eliminar cliente |

---

## Productos — `/api/v1/products/`

| Método | URL | Descripción |
|---|---|---|
| GET | `/products/` | Listar productos (paginado) |
| POST | `/products/` | Crear producto (multipart con imagen) |
| PATCH | `/products/<id>/` | Editar producto |
| DELETE | `/products/<id>/` | Eliminar producto |
| GET | `/products/low_stock/` | Productos con stock bajo |
| POST | `/products/<id>/adjust_stock/` | Ajustar stock manualmente |
| GET | `/products/categorias/` | Listar categorías |
| POST | `/products/categorias/` | Crear categoría |
| GET | `/products/proveedores/` | Listar proveedores |
| POST | `/products/proveedores/` | Crear proveedor |
| PATCH | `/products/proveedores/<id>/` | Editar proveedor |
| DELETE | `/products/proveedores/<id>/` | Eliminar proveedor |
| GET | `/products/compras/` | Historial de compras |
| POST | `/products/compras/` | Registrar compra (actualiza stock) |

---

## Órdenes — `/api/v1/orders/`

| Método | URL | Descripción |
|---|---|---|
| GET | `/orders/ventas/` | Listar ventas |
| POST | `/orders/ventas/` | Crear venta |
| GET | `/orders/ventas/<id>/` | Detalle de venta |
| PATCH | `/orders/ventas/<id>/` | Editar venta |
| PATCH | `/orders/ventas/<id>/confirmar_entrega/` | Confirmar entrega (completed) |
| GET | `/orders/ventas/by_vendedor/?vendedor_id=` | Ventas de un vendedor |
| GET | `/orders/ventas/historial/?vendedor_id=` | Historial con estadísticas |
| GET | `/orders/ventas/<id>/pdf/` | Descargar factura PDF |
| GET | `/orders/detalles/` | Listar detalles de ventas |
| GET | `/orders/pagos/` | Listar pagos |

---

## Auditoría — `/api/v1/audit/`

| Método | URL | Descripción |
|---|---|---|
| GET | `/audit/` | Listar bitácora (solo admin) |

Parámetros de filtro: `?search=`, `?accion=`, `?modulo=`

---

## Paginación

Por defecto: 20 registros por página.

Para obtener todos los registros:
```
GET /api/v1/products/?page_size=10000
```

---

## Acciones registradas en bitácora

| Acción | Descripción |
|---|---|
| `LOGIN` | Inicio de sesión |
| `LOGOUT` | Cierre de sesión |
| `CREATE` | Creación de registro |
| `UPDATE` | Modificación de registro |
| `DELETE` | Eliminación de registro |
| `VENTA` | Confirmación de entrega de venta |
| `COMPRA` | Registro de compra a proveedor |
| `STOCK` | Ajuste manual de stock |
| `RESET_PW` | Restablecimiento de contraseña |
