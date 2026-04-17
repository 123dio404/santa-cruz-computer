/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║                                                                    ║
 * ║          GUÍA RÁPIDA DE REFERENCIA - SANTACRUZ-COMPUTER           ║
 * ║                                                                    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 * 
 * 
 * 🚀 STARTUP RÁPIDO
 * ═════════════════════════════════════════════════════════════════════
 * 
 * npm install --legacy-peer-deps
 * npm run dev
 * 
 * → Acceder a http://localhost:5173
 * → Usar credenciales de prueba (ver abajo)
 * 
 * 
 * 👤 CREDENCIALES DE PRUEBA
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Admin:
 *   usuario: josecaficc2026
 *   pass: 123456
 * 
 * Empleado:
 *   usuario: john_employee
 *   pass: 123456
 * 
 * Cliente:
 *   usuario: jane_customer
 *   pass: 123456
 * 
 * 
 * 📂 ARCHIVOS CLAVE PARA MODIFICAR
 * ═════════════════════════════════════════════════════════════════════
 * 
 * src/app/routes.tsx
 * ├── Agregar nuevas páginas aquí
 * └── Definir permisos por rol
 * 
 * src/app/context/AuthContext.tsx
 * ├── Funciones de login/registro
 * ├── Validaciones
 * └── Gestión de usuarios
 * 
 * src/app/components/Layout.tsx
 * ├── Menú lateral (agregar opciones)
 * └── Header y navegación
 * 
 * src/app/pages/
 * ├── Todas las páginas principales
 * └── Lógica específica de cada sección
 * 
 * src/app/data/mockData.ts
 * ├── Datos simulados de prueba
 * └── Cambiar aquí para modificar datos iniciales
 * 
 * 
 * 🎯 MODIFICACIONES COMUNES
 * ═════════════════════════════════════════════════════════════════════
 * 
 * ¿Agregar una página nueva?
 *   1. Crear: src/app/pages/MiPagina.tsx
 *   2. Importar en routes.tsx
 *   3. Agregar ruta en el array
 *   4. (Opcional) Agregar ícono al menú en Layout.tsx
 * 
 * ¿Cambiar colores del tema?
 *   → Buscar clases Tailwind (bg-blue-600, text-green-700, etc)
 *   → Cambiar en componentes
 *   → O editar tailwind.config.js para cambios globales
 * 
 * ¿Agregar campo a usuario?
 *   1. En AuthContext.tsx - Update interfaz User
 *   2. En mockData.ts - Agregar campo a usuarios mock
 *   3. En Login.tsx - Agregar input en formulario
 *   4. En Users.tsx - Mostrar el campo
 * 
 * ¿Agregar nueva tabla/lista?
 *   → Copiar estructura de Products.tsx o Customers.tsx
 *   → Adaptarla a tus necesidades
 *   → Agregar CRUD (Create, Read, Update, Delete)
 * 
 * 
 * 🔑 CONCEPTOS IMPORTANTES
 * ═════════════════════════════════════════════════════════════════════
 * 
 * useState
 * ├── Hook para guardar estado en componente
 * ├── const [variable, setVariable] = useState(inicial)
 * └── Cambiar estado:setVariable(nuevoValor)
 * 
 * useAuth()
 * ├── Hook para acceder a autenticación global
 * ├── const { user, login, logout } = useAuth()
 * └── Disponible en cualquier componente dentro de App
 * 
 * useNavigate()
 * ├── Hook para navegar entre páginas
 * ├── const navigate = useNavigate()
 * └── Usar: navigate('/dashboard')
 * 
 * useReact Router params
 * ├── const { id } = useParams() - parámetros de URL
 * ├── const location = useLocation() - ubicación actual
 * └── const search = useSearchParams() - query strings
 * 
 * Context API
 * ├── Sistema de estado global sin Redux
 * ├── Provider: envuelve componentes
 * └── Hook: useAuth() accede a datos/funciones
 * 
 * TypeScript types
 * ├── type UserRole = 'admin' | 'employee' | 'client'
 * ├── interface User { ... }
 * └── type Usuario = User - alias para un tipo
 * 
 * 
 * 📦 ESTRUCTURA DE COMPONENTES
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Componente básico:
 * ```typescript
 * export function MiComponente() {
 *   const [estado, setEstado] = useState(inicial)
 *   const { user } = useAuth()
 *   
 *   const handleAccion = () => {
 *     // Lógica aquí
 *     setEstado(nuevoValor)
 *   }
 *   
 *   return (
 *     <div className="space-y-4">
 *       <h1>Mi Título</h1>
 *       <button onClick={handleAccion}>
 *         Hacer algo
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 * 
 * 
 * 🎨 CLASES TAILWIND COMUNES
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Espaciado:
 * p-4 (padding)
 * m-4 (margin)
 * space-y-4 (espacio vertical entre elementos)
 * gap-2 (espacio entre items flex/grid)
 * 
 * Flexbox:
 * flex (contenedor flex)
 * items-center (centrar verticalmente)
 * justify-between (distribuir horizontalmente)
 * gap-4 (espacio entre items)
 * 
 * Colores:
 * bg-blue-600 (fondo azul)
 * text-red-700 (texto rojo)
 * border-gray-200 (borde gris)
 * hover:bg-blue-700 (cambiar en hover)
 * 
 * Tamaño:
 * w-full (100% ancho)
 * h-screen (altura de pantalla)
 * max-w-2xl (máximo ancho)
 * 
 * Responsive:
 * hidden lg:block (oculto en mobile, visible en desktop)
 * md:grid-cols-2 (2 columnas en tablet, 1 en mobile)
 * 
 * 
 * 🛠️ HERRAMIENTAS Y LIBRERÍAS
 * ═════════════════════════════════════════════════════════════════════
 * 
 * React Router v6
 * ├── Navegación entre páginas
 * ├── Routes, Link, Navigate
 * └── useParams, useNavigate, useLocation
 * 
 * Tailwind CSS
 * ├── Clases utilitarias para estilos
 * ├── Responsive design integrado
 * └── Dark mode soportado
 * 
 * shadcn/ui
 * ├── Componentes preexistentes
 * ├── Button, Card, Modal, etc.
 * └── Totalmente customizable
 * 
 * Recharts
 * ├── Gráficos y visualización
 * ├── BarChart, PieChart, LineChart
 * └── Datos interactivos
 * 
 * Lucide React
 * ├── Más de 1000 iconos
 * ├── Importar: import { ChevronDown } from 'lucide-react'
 * └── Usar: <ChevronDown className="w-5 h-5" />
 * 
 * 
 * 🔄 FLUJO DE DATOS
 * ═════════════════════════════════════════════════════════════════════
 * 
 * Backend (no conectado aún)
 *     ↓
 * API (fetch/axios)
 *     ↓
 * AuthContext.tsx (estado global)
 *     ↓
 * Componentes (acceso vía useAuth())
 *     ↓
 * UI (mostrar datos)
 *     ↓
 * Usuario ve/hace algo
 *     ↓
 * Volver al paso 1
 * 
 * 
 * ✅ CHECKLIST ANTES DE MOSTRAR AL TUTOR
 * ═════════════════════════════════════════════════════════════════════
 * 
 * ☐ Todas las páginas funcionan
 * ☐ Puedo loguear con usuario/contraseña
 * ☐ Puedo crear cuenta nueva
 * ☐ Puedo recuperar contraseña (como admin)
 * ☐ Alerta de stock bajo visible
 * ☐ Formulario de productos con imagen funciona
 * ☐ Puedo agregar/editar/eliminar productos
 * ☐ Puedo ver diferentes datos según rol
 * ☐ Los colores están correctos (SantaCruz-Computer)
 * ☐ Responsive (funciona en mobile)
 * ☐ Sin errores en consola (F12)
 * 
 * 
 * 🚨 SI ALGO NO FUNCIONA
 * ═════════════════════════════════════════════════════════════════════
 * 
 * 1. Abre F12 → Console
 * 2. Lee el mensaje de error
 * 3. Busca la línea de código indicada
 * 4. Verifica:
 *    ├── Sintaxis correcta
 *    ├── Imports están presentes
 *    ├── Props enviadas correctamente
 *    └── Estados inicializados
 * 
 * Errores comunes:
 * 
 * "Cannot read property 'map' of undefined"
 * → La variable/array es null/undefined
 * → Agregar: if (!variable) return <div>Cargando...</div>
 * 
 * "useAuth must be used within AuthProvider"
 * → El componente está fuera del Provider
 * → Verificar que esté dentro de App.tsx → AuthProvider
 * 
 * "Path '/ruta' was not matched"
 * → La ruta no existe en routes.tsx
 * → Agregar la ruta al array createBrowserRouter
 * 
 * 
 * 💡 TIPS PROFESIONALES
 * ═════════════════════════════════════════════════════════════════════
 * 
 * • Usar estructura de carpetas coherente
 * • Nombres claros para variables y funciones
 * • Comentarios explicativos en código complejo
 * • Componentes pequeños y reutilizables
 * • Manejo de errores en formularios
 * • Validaciones en cliente y servidor
 * • Separar lógica del UI
 * • Tests unitarios después (Jest/Vitest)
 * • Commit frecuentes en git
 * 
 * 
 * 📚 RECURSOS ÚTILES
 * ═════════════════════════════════════════════════════════════════════
 * 
 * React: https://react.dev
 * TypeScript: https://www.typescriptlang.org
 * Tailwind CSS: https://tailwindcss.com
 * shadcn/ui: https://ui.shadcn.com
 * React Router: https://reactrouter.com
 * 
 */
