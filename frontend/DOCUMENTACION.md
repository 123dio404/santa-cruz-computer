/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                                                                           ║
 * ║         DOCUMENTACIÓN COMPLETA DEL FRONTEND - SANTACRUZ-COMPUTER          ║
 * ║                                                                           ║
 * ║                         Sistema de Gestión de Tienda                      ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 📋 ESTRUCTURA DEL PROYECTO
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * src/
 * ├── main.tsx                          ← Punto de entrada de la aplicación
 * ├── app/
 * │   ├── App.tsx                       ← Componente raíz con proveedores
 * │   ├── routes.tsx                    ← Definición de todas las rutas
 * │   ├── context/
 * │   │   └── AuthContext.tsx           ← Autenticación global
 * │   ├── components/
 * │   │   ├── Layout.tsx                ← Estructura: Sidebar + Header
 * │   │   ├── ProtectedRoute.tsx        ← Protección de rutas por rol
 * │   │   └── figma/
 * │   │       └── ImageWithFallback.tsx ← Componente para imágenes
 * │   ├── pages/
 * │   │   ├── Login.tsx                 ← 🔐 Init/Registro/Recuperación
 * │   │   ├── Dashboard.tsx             ← 📊 Panel principal
 * │   │   ├── Products.tsx              ← 📦 CRUD de productos
 * │   │   ├── Inventory.tsx             ← 🏭 Control de inventario
 * │   │   ├── Sales.tsx                 ← 💰 Registro de ventas
 * │   │   ├── Customers.tsx             ← 👥 Información de clientes
 * │   │   ├── Users.tsx                 ← 👨‍💼 Gestión de usuarios
 * │   │   ├── Suppliers.tsx             ← 🚚 Proveedores
 * │   │   ├── Store.tsx                 ← 🛍️ Tienda virtual
 * │   │   ├── Cart.tsx                  ← 🛒 Carrito de compras
 * │   │   ├── Orders.tsx                ← 📦 Historial de pedidos
 * │   │   └── AdminPanel.tsx            ← 🔐 Panel de admin (passwords)
 * │   ├── data/
 * │   │   └── mockData.ts               ← Datos simulados (sin backend)
 * │   └── ui/                           ← Componentes UI reutilizables
 * │       └── [shadcn components]       ← botones, cards, modales, etc.
 * └── styles/
 *     ├── index.css                     ← Estilos globales
 *     ├── tailwind.css                  ← Configuración Tailwind
 *     ├── theme.css                     ← Temas personalizados
 *     └── fonts.css                     ← Fuentes personalizadas
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 🔐 ROLES Y PERMISOS
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * ADMIN (Administrador)
 * ├── Dashboard ✓
 * ├── Productos (Crear, Editar, Eliminar) ✓
 * ├── Inventario ✓
 * ├── Ventas ✓
 * ├── Clientes ✓
 * ├── Usuarios ✓
 * ├── Proveedores ✓
 * ├── Panel Admin (Recuperación de contraseñas) ✓
 * └── Alerta de Stock Bajo ✓
 * 
 * EMPLOYEE (Empleado)
 * ├── Dashboard ✓
 * ├── Inventario ✓
 * ├── Ventas ✓
 * ├── Clientes ✓
 * └── Alerta de Stock Bajo ✓
 * 
 * CLIENT (Cliente)
 * ├── Tienda Virtual ✓
 * ├── Carrito de Compras ✓
 * └── Mis Pedidos ✓
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 🔑 USUARIOS DE PRUEBA
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * 👨‍💼 ADMIN
 * Usuario: josecaficc2026
 * Contraseña: 123456
 * Acceso: COMPLETO
 * 
 * 👨‍💻 EMPLEADO
 * Usuario: john_employee
 * Contraseña: 123456
 * Acceso: Dashboard, Inventario, Ventas, Clientes
 * 
 * 🛍️ CLIENTE
 * Usuario: jane_customer
 * Contraseña: 123456
 * Acceso: Tienda, Carrito, Mis Pedidos
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 📡 FLUJO DE AUTENTICACIÓN
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * 1. LOGIN (Login.tsx)
 *    ↓
 *    El usuario ingresa:
 *    - Usuario: josecaficc2026
 *    - Contraseña: 123456
 *    ↓
 *    AuthContext.login() verifica en BD mock
 *    ↓
 *    Si es correcto: setUser() + navigate('/dashboard')
 *    Si es incorrecto: mostrar error
 * 
 * 2. REGISTRO (Login.tsx - Tab "Crear Cuenta Nueva")
 *    ↓
 *    El usuario ingresa:
 *    - Nombre, Apellido
 *    - Usuario (con validación de disponibilidad)
 *    - Email, Teléfono, Ciudad
 *    - Sexo, Fecha de Nacimiento
 *    - Contraseña (con mostrar/ocultar)
 *    ↓
 *    AuthContext.register() crea nuevo usuario
 *    ↓
 *    Logeo automático + navigate('/dashboard')
 * 
 * 3. RECUPERACIÓN DE CONTRASEÑA (Login.tsx - "Olvidé contraseña")
 *    ↓
 *    Ingresa usuario → recibe código por email (simulado)
 *    ↓
 *    Ingresa código + nueva contraseña
 *    ↓
 *    Contraseña actualizada → volver a login
 * 
 * 4. RESET POR ADMIN (AdminPanel.tsx)
 *    ↓
 *    Admin busca usuario por nombre/email/usuario
 *    ↓
 *    Selecciona usuario → ingresa nueva contraseña
 *    ↓
 *    System.resetUserPassword() - Contraseña actualizada
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 🛒 FLUJO DE COMPRA (Cliente)
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Store.tsx (Tienda Virtual)
 * ├── Ver catálogo de productos
 * ├── Filtrar por categoría
 * ├── Ver detalles del producto
 * └── Agregar al carrito ✓
 *     ↓
 * Cart.tsx (Carrito)
 * ├── Ver productos seleccionados
 * ├── Cambiar cantidades
 * ├── Eliminar productos
 * └── Procesar compra ✓
 *     ↓
 * Sale se registra (Sales.tsx)
 * ↓
 * Order se crea (Orders.tsx - ver historial)
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * ⚠️ ALERTAS IMPORTANTES
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * 1. STOCK BAJO (Dashboard.tsx)
 *    ├── Se muestra cuando: stock <= minStock
 *    ├── Visible para: Admin, Empleado
 *    ├── Color: Rojo/Naranja (muy visible)
 *    ├── Animación: Pulso en ícono de alerta
 *    └── Acción sugerida: Hacer pedido urgente a proveedor
 * 
 * 2. ALERTA EN PRODUCTS.tsx
 *    ├── Cuando cargas una imagen por archivo:
 *    │   ├── Validación: JPG, JPEG, PNG
 *    │   ├── Tamaño máx: 5 MB
 *    │   └── Conversión a Base64 (se guarda con producto)
 *    ├── Cuando cargas por URL:
 *    │   ├── Validación: URL válida
 *    │   └── Debe ser accesible desde internet
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 🎨 TECNOLOGÍAS UTILIZADAS
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * FRAMEWORK: React 18 + TypeScript
 * ├── React Hooks (useState, useContext, useNavigate)
 * ├── React Router v6 (Navegación)
 * └── Context API (Autenticación global)
 * 
 * ESTILOS: Tailwind CSS
 * ├── Clases utilitarias para estilos
 * ├── Responsive Design (mobile-first)
 * └── Dark mode soportado
 * 
 * COMPONENTES: shadcn/ui
 * ├── Botones, Cards, Inputs
 * ├── Modales, Dropdowns, Tablas
 * ├── Date Pickers, Checkboxes
 * └── Componentes accesibles y reutilizables
 * 
 * GRÁFICOS: Recharts
 * ├── Bar Charts (gráficos de barras)
 * ├── Pie Charts (gráficos de pastel)
 * └── Tooltips interactivos
 * 
 * ICONOS: Lucide React
 * ├── Iconos SVG escalables
 * ├── Más de 1000 iconos disponibles
 * └── Animaciones suaves
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 🔧 CÓMO AGREGAR UNA NUEVA PÁGINA
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * 1. CREAR EL ARCHIVO
 *    ```
 *    src/app/pages/MiPagina.tsx
 *    ```
 * 
 * 2. ESCRIBIR COMPONENTE
 *    ```typescript
 *    import { useAuth } from '../context/AuthContext'
 *    
 *    export function MiPagina() {
 *      const { user } = useAuth()
 *      
 *      return (
 *        <div className="space-y-6">
 *          <div>
 *            <h1 className="text-2xl font-bold">Mi Nueva Página</h1>
 *            <p className="text-gray-600">Descripción</p>
 *          </div>
 *          
 *          {/* Tu contenido aquí */}
 *        </div>
 *      )
 *    }
 *    ```
 * 
 * 3. IMPORTAR EN routes.tsx
 *    ```typescript
 *    import { MiPagina } from './pages/MiPagina'
 *    ```
 * 
 * 4. AGREGAR RUTA
 *    ```typescript
 *    {
 *      path: '/mi-pagina',
 *      element: (
 *        <ProtectedRoute allowedRoles={['admin']}>
 *          <Layout>
 *            <MiPagina />
 *          </Layout>
 *        </ProtectedRoute>
 *      )
 *    }
 *    ```
 * 
 * 5. AGREGAR AL MENÚ (opcional)
 *    En Layout.tsx, dentro de getNavItems():
 *    ```typescript
 *    { path: '/mi-pagina', icon: MiIcono, label: 'Mi Página' }
 *    ```
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 💾 CÓMO FUNCIONA EL ALMACENAMIENTO
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * ACTUALMENTE (Mock - Datos Simulados):
 * ├── Datos se guardan en memoria del navegador
 * ├── Se pierden al recargar la página
 * ├── Perfecto para demostración
 * └── Archivo: src/app/data/mockData.ts
 * 
 * POR HACER (Cuando se conecte Backend):
 * ├── Crear carpeta Backend con Node.js/Express
 * ├── Conectar a PostgreSQL (como mencionaste)
 * ├── Reemplazar las funciones mock del AuthContext
 * ├── Agregar llamadas HTTP (fetch/axios)
 * ├── Usar JWT tokens para autenticación
 * └── Almacenamiento persistente en BD
 * 
 * PASOS PARA CONECTAR BACKEND:
 * 1. Crear archivo .env con URL del backend:
 *    VITE_API_URL=http://localhost:3000/api
 * 
 * 2. En AuthContext.tsx, cambiar:
 *    const response = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
 *      method: 'POST',
 *      body: JSON.stringify({ username, password })
 *    })
 * 
 * 3. Procesar respuesta del backend
 * 
 * 4. Guardar token JWT en localStorage
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 🐛 DEBUGGING Y HERRAMIENTAS
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * DEVELOPER TOOLS:
 * ├── F12 → Inspector de elementos
 * ├── Console → Errores y logs
 * ├── Network → Llamadas HTTP (cuando haya backend)
 * └── Storage → localStorage (datos guardados)
 * 
 * REACT DEVELOPER TOOLS:
 * ├── Extensión del navegador
 * ├── Ver componentes React
 * ├── Inspeccionar props y state
 * └── Profiler (rendimiento)
 * 
 * LOGS EN CONSOLA:
 * ```typescript
 * console.log('Variable:', variable)
 * console.error('Error:', error)
 * console.warn('Advertencia:', algo)
 * console.table(datos)  // Mostrar en tabla
 * ```
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * ❓ PREGUNTAS FRECUENTES
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * P: ¿Dónde cambio el nombre de la empresa?
 * R: grep -r "SantaCruz-Computer" src/
 *    Cambiar en: Layout.tsx, Login.tsx, Sales.tsx
 * 
 * P: ¿Cómo agrego un nuevo rol de usuario?
 * R: En AuthContext.tsx:
 *    export type UserRole = 'admin' | 'employee' | 'client' | 'supervisor'
 *    Luego actualizar getNavItems() en Layout.tsx
 * 
 * P: ¿Cómo cambio los colores del tema?
 * R: tailwind.css - Buscar colores Tailwind
 *    O en componentes individuales cambiar las clases
 *    Ej: bg-blue-600 → bg-purple-600
 * 
 * P: ¿Cómo agrego validaciones más estrictas?
 * R: En los componentes, agregar validaciones en handleSubmit()
 *    O crear archivo utils/validations.ts
 * 
 * P: ¿Los datos se guardan en la base de datos?
 * R: NO - actualmente es todo mock/simulado
 *    Se pierden al recargar. Necesitas Backend.
 * 
 * 
 * ════════════════════════════════════════════════════════════════════════════
 * 📞 PRÓXIMOS PASOS
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * 1. CONECTAR BACKEND
 *    ├── Crear servidor Node.js/Express
 *    ├── Base de datos PostgreSQL
 *    ├── Endpoints REST API
 *    └── Autenticación JWT
 * 
 * 2. PERSISTENCIA DE DATOS
 *    ├── Guardar productos
 *    ├── Guardar usuarios registrados
 *    ├── Guardar ventas
 *    └── Guardar imágenes en servidor
 * 
 * 3. MEJORAS UX/UI
 *    ├── Animaciones adicionales
 *    ├── Notificaciones (Toast/Alerts)
 *    ├── Carga de datos (Loading spinners)
 *    └── Validaciones más detalladas
 * 
 * 4. FUNCIONALIDADES AVANZADAS
 *    ├── Reporte de ventas (PDF)
 *    ├── Exportar datos (Excel)
 *    ├── Gráficos avanzados
 *    └── Búsqueda y filtros mejorados
 * 
 */
