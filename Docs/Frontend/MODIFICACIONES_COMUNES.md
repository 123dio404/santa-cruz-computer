# Modificaciones Comunes

## Cambiar colores del tema

El proyecto usa Tailwind CSS. El color principal es azul (`blue`).

Para cambiar globalmente de azul a otro color, usar Buscar y Reemplazar en VS Code (`Ctrl+H`):
- Buscar: `bg-blue-600`
- Reemplazar: `bg-purple-600`

Archivos principales con colores:
- `src/app/components/Layout.tsx`
- `src/app/pages/Login.tsx`
- `src/app/pages/Dashboard.tsx`

---

## Agregar una nueva página

1. Crear el archivo:
```
src/app/pages/MiPagina.tsx
```

2. Estructura mínima:
```typescript
import { useAuth } from '../context/AuthContext';

export function MiPagina() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Página</h1>
        <p className="text-gray-600">Descripción</p>
      </div>
    </div>
  );
}
```

3. Agregar en `routes.tsx`:
```typescript
import { MiPagina } from './pages/MiPagina';

// Dentro del router:
{
  path: '/mi-pagina',
  element: (
    <ProtectedRoute allowedRoles={['admin']}>
      <Layout><MiPagina /></Layout>
    </ProtectedRoute>
  )
}
```

4. Agregar al menú en `Layout.tsx` dentro de `adminItems` o `employeeItems`:
```typescript
{ path: '/mi-pagina', icon: MiIcono, label: 'Mi Página' }
```

---

## Agregar una nueva llamada al backend

En `src/app/services/api.ts`, agregar dentro del objeto correspondiente:

```typescript
export const miRecursoAPI = {
  getAll: async () => {
    const resp = await fetch(`${API_BASE_URL}/mi-recurso/?page_size=1000`, {
      headers: authHeaders(),
    });
    return handlePaginated(await handleJson(resp));
  },
  create: async (data: any) => {
    const resp = await fetch(`${API_BASE_URL}/mi-recurso/`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(resp);
  },
};
```

---

## Cambiar columnas visibles en una tabla

En la página correspondiente, buscar el bloque `<thead>` y agregar/quitar `<th>`.
Para hacer una columna responsiva (oculta en móvil):
```tsx
<th className="hidden md:table-cell px-4 py-3 ...">Mi Columna</th>
```

Y en las filas `<td>` aplicar la misma clase `hidden md:table-cell`.

---

## Cambiar la imagen de un producto

Las imágenes de productos se muestran con `object-contain` y fondo gris claro:
```tsx
<img
  src={product.imagen_url}
  alt={product.name}
  className="w-full h-full object-contain p-2"
/>
```

Para cambiar a que recorte la imagen (llenar el espacio):
```tsx
className="w-full h-full object-cover"
```

---

## Modificar el filtro de fechas

El patrón usado en `Suppliers.tsx` y `AuditLog.tsx`:

```typescript
const filtered = items.filter(item => {
  const fecha = new Date(item.fecha);
  const desde = histDesde ? new Date(histDesde) : null;
  const hasta  = histHasta ? new Date(histHasta + 'T23:59:59') : null;
  return (!desde || fecha >= desde) && (!hasta || fecha <= hasta);
});
```

Reutilizar este patrón en cualquier listado con fechas.
