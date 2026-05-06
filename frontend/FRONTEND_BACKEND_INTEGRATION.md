# 🔗 Guía de Integración Frontend-Backend

## Status Actual

✅ **Backend (Django)** está corriendo en `http://localhost:8000`
✅ **Frontend (React)** está corriendo en `http://localhost:5174`
✅ **Base de Datos PostgreSQL** conectada correctamente

## Datos de Prueba Disponibles

### Usuarios en la BD:
```
1. Admin
   - Email: admin@mail.com
   - Rol: admin

2. Vendedor
   - Email: vend@mail.com
   - Rol: vendedor

3. Cliente
   - Email: cliente@mail.com
   - Rol: cliente
```

### Productos:
```
1. Laptop Asus - $850.00 (stock: 10)
2. Mouse Logitech - $50.00 (stock: 20)
```

## Endpoints API Disponibles

### Autenticación
```
POST /api/v1/users/login/
Body: { "email": "admin@mail.com" }
Response: { access_token, refresh_token, user_data }
```

### Usuarios
```
GET /api/v1/users/
GET /api/v1/users/{id}/
GET /api/v1/users/by_role/?role=admin
POST /api/v1/users/
PATCH /api/v1/users/{id}/
DELETE /api/v1/users/{id}/
```

### Productos
```
GET /api/v1/products/
GET /api/v1/products/{id}/
GET /api/v1/products/low_stock/
POST /api/v1/products/
PATCH /api/v1/products/{id}/
DELETE /api/v1/products/{id}/
POST /api/v1/products/{id}/adjust_stock/
```

### Ventas (Órdenes)
```
GET /api/v1/orders/ventas/
GET /api/v1/orders/ventas/{id}/
POST /api/v1/orders/ventas/
PATCH /api/v1/orders/ventas/{id}/
DELETE /api/v1/orders/ventas/{id}/
```

### Detalles de Venta
```
GET /api/v1/orders/detalles/
GET /api/v1/orders/detalles/?venta={ventaId}
POST /api/v1/orders/detalles/
```

### Pagos
```
GET /api/v1/orders/pagos/
GET /api/v1/orders/pagos/?venta={ventaId}
POST /api/v1/orders/pagos/
```

## Cómo Usar el Servicio API en React

### 1. Importar el servicio API
```typescript
import { usuariosAPI, productosAPI, ventasAPI, authAPI } from '@/services/api';
```

### 2. Usar en un componente
```typescript
import { useEffect, useState } from 'react';
import { usuariosAPI, ApiUser } from '@/services/api';

export function UsuariosComponent() {
  const [usuarios, setUsuarios] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const data = await usuariosAPI.getAll();
        setUsuarios(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarUsuarios();
  }, []);

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      {usuarios.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

### 3. Login con Backend
```typescript
import { authAPI } from '@/services/api';

const handleLogin = async (email: string) => {
  try {
    const response = await authAPI.login(email);
    console.log('Usuario:', response.user);
    console.log('Token:', response.access);
    
    // Guardar el token
    localStorage.setItem('access_token', response.access);
    
    // Redirigir según el rol
    if (response.user.role === 'admin') {
      navigate('/dashboard');
    }
  } catch (error) {
    console.error('Login fallido:', error);
  }
};
```

## Proximos Pasos para Integración Completa

1. ✅ Crear servicio API (`api.ts`)
2. ✅ Crear hook personalizado (`useBackendAuth.ts`)
3. ⏳ Actualizar Login.tsx para usar el backend
4. ⏳ Actualizar Products.tsx para cargar desde API
5. ⏳ Actualizar Users.tsx para cargar desde API
6. ⏳ Actualizar Orders.tsx para cargar desde API
7. ⏳ Implementar autenticación JWT en headers
8. ⏳ Manejar errores y estados de carga

## Pruebas Rápidas

### Probar endpoint de usuarios
```bash
curl http://localhost:8000/api/v1/users/
```

### Probar login
```bash
curl -X POST http://localhost:8000/api/v1/users/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mail.com"}'
```

### Probar productos
```bash
curl http://localhost:8000/api/v1/products/
```

## Notas Importantes

- ⚠️ Autenticación JWT está configurada en el backend
- ⚠️ CORS está permitido para localhost:5173 y localhost:5174
- ⚠️ Todos los endpoints requieren token excepto `/login/`
- ⚠️ La base de datos PostgreSQL tiene triggers para stock y pagos
- ⚠️ Django no recreará tablas (managed = False)

## Archivos Creados

- `src/app/services/api.ts` - Servicio HTTP con todos los endpoints
- `src/app/hooks/useBackendAuth.ts` - Hook personalizado para autenticación
- `FRONTEND_BACKEND_INTEGRATION.md` - Este archivo

## ¿Necesitas Ayuda?

Para actualizar un componente específico con datos del backend, indica cuál y te muestro cómo conectarlo.
