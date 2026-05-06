/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                                                                    ║
 * ║        MANUAL DE MODIFICACIONES - CAMBIOS COMUNES QUE PIDE EL     ║
 * ║                      TUTOR O CLIENTES                             ║
 * ║                                                                    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * 
 * 🎨 CAMBIAR COLORES DEL TEMA
 * ═════════════════════════════════════════════════════════════════════
 * 
 * El proyecto usa Tailwind CSS. Los colores principales son azul
 * 
 * PASOS:
 * 1. Abre VS Code y busca (Ctrl+H - Reemplazar):
 *    - bg-blue- → bg-[color]-
 *    - text-blue- → text-[color]-
 * 
 * COLORES DISPONIBLES:
 * red, orange, yellow, green, blue, purple, pink, slate, gray
 * 
 * EJEMPLO - Cambiar de AZUL a MORADO:
 * 
 * En cualquier archivo donde veas: bg-blue-600
 * Reemplaza con: bg-purple-600
 * 
 * Archivos principales que usan colores:
 * - src/app/components/Layout.tsx
 * - src/app/pages/Dashboard.tsx
 * - src/app/pages/Login.tsx
 * - src/app/pages/Products.tsx
 * 
 * INTENSIDAD DE COLORES:
 * bg-blue-50 (muy claro)
 * bg-blue-100
 * bg-blue-200
 * bg-blue-300
 * bg-blue-400
 * bg-blue-500
 * bg-blue-600 (más común)
 * bg-blue-700
 * bg-blue-800
 * bg-blue-900 (muy oscuro)
 * 
 * 
 * 📝 CAMBIAR NOMBRE DE LA EMPRESA
 * ═════════════════════════════════════════════════════════════════════
 * 
 * El nombre "SantaCruz-Computer" aparece en varios lugares
 * 
 * PASOS:
 * 1. Ctrl+H (Reemplazar en todos los archivos)
 * 2. Buscar: SantaCruz-Computer
 * 3. Reemplazar por: Tu Empresa
 * 4. Click "Replace All"
 * 
 * Archivos modificados automáticamente:
 * ✓ src/app/components/Layout.tsx
 * ✓ src/app/pages/Login.tsx
 * ✓ src/app/pages/Sales.tsx (en facturas)
 * 
 * 
 * 👥 AGREGAR NUEVO ROL DE USUARIO
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Supongamos que quieres agregar "supervisor"
 * 
 * PASO 1: Editar AuthContext.tsx
 * ─────────────────────────────────
 * Busca la línea:
 *   export type UserRole = 'admin' | 'employee' | 'client';
 * 
 * Cambia a:
 *   export type UserRole = 'admin' | 'employee' | 'client' | 'supervisor';
 * 
 * PASO 2: Editar Layout.tsx
 * ──────────────────────────
 * Busca la función getNavItems()
 * 
 * Agrega (después de employeeItems):
 *   const supervisorItems = [
 *     { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
 *     { path: '/inventory', icon: Warehouse, label: 'Inventario' },
 *     { path: '/sales', icon: ShoppingCart, label: 'Ventas' }
 *   ];
 * 
 * Busca el return de getNavItems y agrega:
 *   if (user.role === 'supervisor') return supervisorItems;
 * 
 * PASO 3: Editar routes.tsx (actualizar permisos)
 * ────────────────────────────────────────────────
 * En cada ruta, cambiar:
 *   allowedRoles={['admin', 'employee']}
 * 
 * A:
 *   allowedRoles={['admin', 'employee', 'supervisor']}
 * 
 * Si el supervisor tiene acceso a esa página
 * 
 * 
 * ➕ AGREGAR NUEVA COLUMNA A TABLA
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Ejemplo: Agregar "Edad" a la tabla de Usuarios
 * 
 * PASO 1: Actualizar tipo User (AuthContext.tsx)
 * ───────────────────────────────────────────────
 * En la interfaz User, agregar:
 *   age?: number;  // "?" = opcional
 * 
 * PASO 2: Actualizar datos mock (data/mockData.ts)
 * ─────────────────────────────────────────────────
 * En mockUsers, agregar a cada usuario:
 *   age: 25,
 * 
 * PASO 3: Actualizar formulario (en la página correspondiente)
 * ──────────────────────────────────────────────────────────────
 * En Login.tsx (registro), agregar input:
 *   <input
 *     type="number"
 *     value={formData.age}
 *     onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
 *     placeholder="Edad"
 *   />
 * 
 * PASO 4: Actualizar tabla (Users.tsx por ejemplo)
 * ──────────────────────────────────────────────────
 * En la tabla, agregar columna:
 *   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
 *     {user.age} años
 *   </td>
 * 
 * 
 * 🔒 CAMBIAR CONTRASEÑA POR DEFECTO
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Actualmente todos usan "123456"
 * 
 * PASO 1: AuthContext.tsx
 * ──────────────────────
 * En la función login(), busca:
 *   if (foundUser && password === '123456')
 * 
 * Cambia a:
 *   if (foundUser && password === 'tu_nueva_pass')
 * 
 * En register(), busca:
 *   if (password !== '123456')
 * 
 * Cambia a:
 *   if (password !== 'tu_nueva_pass')
 * 
 * ⚠️ IMPORTANTE: Esto también cambiaría para registro nuevo
 *    En producción, necesitarías permitir contraseñas diferentes
 * 
 * 
 * 🖼️ CAMBIAR LOGO/IMAGEN PRINCIPAL
 * ═════════════════════════════════════════════════════════════════════
 * 
 * El logo actual es un círculo azul con ícono
 * 
 * En Layout.tsx, busca:
 *   <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
 *     <LogIn className="w-8 h-8 text-white" />
 *   </div>
 * 
 * OPCIÓN 1: Cambiar el ícono
 * ──────────────────────────
 * Reemplaza LogIn por otro (de lucide-react):
 * import { Store } from 'lucide-react'
 * <Store className="w-8 h-8 text-white" />
 * 
 * OPCIÓN 2: Cambiar color del fondo
 * ──────────────────────────────────
 * Cambia bg-blue-600 a otro color:
 * bg-purple-600, bg-red-600, etc.
 * 
 * OPCIÓN 3: Mostrar imagen en lugar de ícono
 * ─────────────────────────────────────────
 * <img src="/logo.png" alt="Logo" className="w-16 h-16" />
 * (Pon la imagen en public/logo.png)
 * 
 * 
 * 📋 CAMBIAR CATEGORÍAS DE PRODUCTOS
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Actualmente: Laptops, Periféricos, Componentes, Almacenamiento
 * 
 * PASO 1: Products.tsx
 * ────────────────────
 * Busca:
 *   <option value="Laptops">Laptops</option>
 *   <option value="Periféricos">Periféricos</option>
 *   ...
 * 
 * Reemplaza por tus categorías:
 *   <option value="Electrónica">Electrónica</option>
 *   <option value="Ropa">Ropa</option>
 *   ...
 * 
 * PASO 2: mockData.ts (actualizar productos existentes)
 * ──────────────────────────────────────────────────────
 * En mockProducts, cambiar category de cada producto
 * 
 * 
 * 👤 AGREGAR NUEVO USUARIO DE PRUEBA
 * ═════════════════════════════════════════════════════════════════════
 * 
 * En data/mockData.ts, busca mockUsers array
 * 
 * Agrega un nuevo usuario:
 * 
 * {
 *   id: '4',
 *   name: 'Carlos',
 *   lastName: 'Manager',
 *   username: 'carlos_manager',
 *   email: 'carlos@store.com',
 *   gender: 'masculino',
 *   city: 'La Paz',
 *   phone: '+591 111222333',
 *   birthDate: '1988-12-10',
 *   role: 'admin'
 * }
 * 
 * Ahora puedes loguear con:
 * usuario: carlos_manager
 * contraseña: 123456
 * 
 * 
 * 🔔 CAMBIAR CONFIGURACIÓN DE ALERTAS
 * ═════════════════════════════════════════════════════════════════════
 * 
 * La alerta de stock bajo se muestra cuando: stock <= minStock
 * 
 * En Dashboard.tsx, busca:
 *   const lowStock = mockProducts.filter(p => p.stock <= p.minStock);
 * 
 * OPCIÓN: Cambiar a stock crítico (más estricto)
 * Cambiar a:
 *   const lowStock = mockProducts.filter(p => p.stock < 5);
 * 
 * OPCIÓN: Cambiar a stock bajo (menos estricto)
 * Cambiar a:
 *   const lowStock = mockProducts.filter(p => p.stock <= p.minStock * 2);
 * 
 * 
 * 📧 CAMBIAR EMAIL EN LA FACTURA
 * ═════════════════════════════════════════════════════════════════════
 * 
 * En Sales.tsx, busca:
 *   <p className="text-sm text-gray-500">ventas@store.com</p>
 *   <p className="text-sm text-gray-500">Av. Arce 2147, La Paz</p>
 *   <p className="text-sm text-gray-500">NIT: 1234567890</p>
 * 
 * Cambia a tu información real
 * 
 * 
 * 🎓 AGREGAR NUEVA PÁGINA (Paso a Paso Completo)
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Vamos a crear una página "Reportes"
 * 
 * PASO 1: Crear archivo
 * ──────────────────────
 * Crear: src/app/pages/Reports.tsx
 * 
 * Copiar este template:
 * 
 * export function Reports() {
 *   return (
 *     <div className="space-y-6">
 *       <div>
 *         <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
 *         <p className="text-gray-600">Análisis de ventas y productos</p>
 *       </div>
 *       
 *       <div className="bg-white rounded-xl p-6 border border-gray-200">
 *         <h2 className="text-xl font-semibold mb-4">Mis Reportes</h2>
 *         {/* Tu contenido aquí */}
 *       </div>
 *     </div>
 *   )
 * }
 * 
 * PASO 2: Importar en routes.tsx
 * ───────────────────────────────
 * Agrega al inicio:
 * import { Reports } from './pages/Reports'
 * 
 * PASO 3: Agregar ruta
 * ────────────────────
 * En el array createBrowserRouter, agrega:
 * 
 * {
 *   path: '/reports',
 *   element: (
 *     <ProtectedRoute allowedRoles={['admin', 'employee']}>
 *       <Layout>
 *         <Reports />
 *       </Layout>
 *     </ProtectedRoute>
 *   )
 * }
 * 
 * PASO 4: Agregar al menú (Layout.tsx)
 * ────────────────────────────────────
 * En getNavItems(), agrega a adminItems y employeeItems:
 * { path: '/reports', icon: BarChart3, label: 'Reportes' }
 * 
 * (Importa el ícono: import { BarChart3 } from 'lucide-react')
 * 
 * ¡Listo! Ya puedes acceder a /reports desde el menú
 * 
 * 
 * 🚀 TIPS FINALES
 * ═════════════════════════════════════════════════════════════════════
 * 
 * • Siempre hacer cambios en archivo correcto
 * • Probar en navegador (F5 para recargar)
 * • Ver console (F12) para errores
 * • Hacer cambios pequeños
 * • Probar después de cada cambio
 * • Si algo falla, deshacer (Ctrl+Z)
 * • Usar Git para versiones (git commit)
 * 
 */
