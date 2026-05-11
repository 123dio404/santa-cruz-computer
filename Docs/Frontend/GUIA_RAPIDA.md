# Guía Rápida — Frontend

## Iniciar el frontend

```bash
cd "proyecto si1 santacruz computer\Frontend"
npm run dev
```

Acceder en: `http://localhost:5173`

## Credenciales

Los usuarios se gestionan desde la base de datos PostgreSQL. Crear usuarios desde:
- `http://localhost:5173/users` (admin) — pestaña Personal
- `http://localhost:5173/users` (admin) — pestaña Clientes

## Archivos clave

| Archivo | Para qué |
|---|---|
| `src/app/routes.tsx` | Agregar/modificar rutas y permisos |
| `src/app/services/api.ts` | Agregar llamadas al backend |
| `src/app/components/Layout.tsx` | Modificar menú lateral |
| `src/app/context/AuthContext.tsx` | Lógica de autenticación global |
| `src/app/pages/*.tsx` | Páginas del sistema |

## Agregar una nueva página

```
1. Crear src/app/pages/MiPagina.tsx
2. Importar en routes.tsx
3. Agregar ruta con ProtectedRoute y allowedRoles
4. Agregar ítem al menú en Layout.tsx
```

## Errores comunes

| Error en consola | Causa | Solución |
|---|---|---|
| `Cannot read property of undefined` | El array es null | Agregar `?? []` al estado inicial |
| `401 Unauthorized` | Token expirado | Cerrar sesión y volver a entrar |
| `Network Error` | Backend no está corriendo | Iniciar `python manage.py runserver` |
| Solo 20 registros | Paginación por defecto | Agregar `?page_size=1000` en api.ts |

## Íconos disponibles (Lucide)

```typescript
import { Package, ShoppingCart, Users, BarChart3, Truck } from 'lucide-react';

// Usar:
<Package className="w-5 h-5 text-blue-600" />
```

## Clases Tailwind más usadas

```
Contenedor:   bg-white rounded-xl border border-gray-200 p-6
Título:       text-2xl font-bold text-gray-900
Subtítulo:    text-sm text-gray-600
Botón azul:   px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
Botón rojo:   px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100
Badge verde:  px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium
Badge rojo:   px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium
```
