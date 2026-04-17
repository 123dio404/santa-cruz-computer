/**
 * routes.tsx - Definición de Todas las Rutas de la Aplicación
 * 
 * Este archivo centraliza la configuración de todas las URLs (rutas) de la aplicación.
 * 
 * ESTRUCTURA:
 * - Cada ruta tiene una URL (path) y un componente que se muestra
 * - ProtectedRoute: Componente que verifica autenticación y permisos
 * - Layout: Componente que proporciona el sidebar y header
 * - allowedRoles: Define quién puede acceder a esa ruta (admin, employee, client)
 * 
 * CÓMO AGREGAR UNA NUEVA PÁGINA:
 * 1. Crear el archivo en src/app/pages/MiPagina.tsx
 * 2. Importarlo arriba: import { MiPagina } from './pages/MiPagina'
 * 3. Agregar la ruta en el array createBrowserRouter:
 *    {
 *      path: '/mi-pagina',
 *      element: (
 *        <ProtectedRoute allowedRoles={['admin']}>  // Cambiar según necesites
 *          <Layout>
 *            <MiPagina />
 *          </Layout>
 *        </ProtectedRoute>
 *      )
 *    }
 */

import { createBrowserRouter, Navigate } from 'react-router';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Users } from './pages/Users';
import { Customers } from './pages/Customers';
import { Suppliers } from './pages/Suppliers';
import { Store } from './pages/Store';
import { Cart } from './pages/Cart';
import { Orders } from './pages/Orders';
import { AdminPanel } from './pages/AdminPanel';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

/**
 * Definición de todas las rutas de la aplicación
 * El router automáticamente navega según la URL
 */
export const router = createBrowserRouter([
  // ============ RUTAS PÚBLICAS (sin protección) ============
  
  /**
   * /login - Página de Inicio de Sesión
   * - No requiere autenticación
   * - Aquí es donde los usuarios ingresan con su usuario y contraseña
   */
  {
    path: '/login',
    element: <Login />
  },

  // ============ RUTAS PROTEGIDAS (requieren estar logueado) ============

  /**
   * / - Ruta raíz (página de inicio)
   * - Redirige automáticamente al dashboard
   */
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout>
          <Navigate to="/dashboard" replace />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /dashboard - Panel Principal
   * - Resumen visual de toda la aplicación
   * - Gráficos de ventas, stock bajo, productos populares
   * - Acceso: Admin, Empleado
   */
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'employee']}>
        <Layout>
          <Dashboard />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /products - Gestión de Productos
   * - CRUD: Crear, Leer, Actualizar, Eliminar productos
   * - Cargar imágenes (URL o archivo)
   * - Definir precios y categorías
   * - Acceso: Solo Admin
   */
  {
    path: '/products',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <Layout>
          <Products />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /inventory - Control de Inventario
   * - Ver stock de todos los productos
   * - Actualizar cantidades
   * - Alertas de stock bajo
   * - Acceso: Admin, Empleado
   */
  {
    path: '/inventory',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'employee']}>
        <Layout>
          <Inventory />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /sales - Gestión de Ventas
   * - Registrar ventas de productos
   * - Ver historial de ventas
   * - Generar facturas
   * - Acceso: Admin, Empleado
   */
  {
    path: '/sales',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'employee']}>
        <Layout>
          <Sales />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /users - Gestión de Usuarios del Sistema
   * - Ver empleados y su información
   * - Campos: nombre, email, rol, ciudad, teléfono, fecha de nacimiento
   * - Acceso: Solo Admin
   */
  {
    path: '/users',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <Layout>
          <Users />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /customers - Gestión de Clientes
   * - Ver clientes de la tienda
   * - Información de compras
   * - Detalles de contacto
   * - Acceso: Admin, Empleado
   */
  {
    path: '/customers',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'employee']}>
        <Layout>
          <Customers />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /suppliers - Gestión de Proveedores
   * - Información de proveedores de productos
   * - Contactos y datos de entrega
   * - Acceso: Solo Admin
   */
  {
    path: '/suppliers',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <Layout>
          <Suppliers />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /store - Tienda Virtual para Clientes
   * - Catálogo de productos visible para clientes
   * - Compra de productos
   * - Acceso: Solo Clientes
   */
  {
    path: '/store',
    element: (
      <ProtectedRoute allowedRoles={['client']}>
        <Layout>
          <Store />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /cart - Carrito de Compras
   * - Productos agregados por el cliente
   * - Revisar antes de comprar
   * - Acceso: Solo Clientes
   */
  {
    path: '/cart',
    element: (
      <ProtectedRoute allowedRoles={['client']}>
        <Layout>
          <Cart />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /orders - Mis Pedidos (para clientes)
   * - Ver historial de compras personales
   * - Seguimiento de entregas
   * - Facturas y detalles
   * - Acceso: Solo Clientes
   */
  {
    path: '/orders',
    element: (
      <ProtectedRoute allowedRoles={['client']}>
        <Layout>
          <Orders />
        </Layout>
      </ProtectedRoute>
    )
  },

  /**
   * /admin-panel - Panel Administrativo
   * - Recuperación de contraseñas de usuarios olvidados
   * - Solo el admin puede resetear contraseñas
   * - Buscar usuarios por nombre, email, usuario
   * - Acceso: Solo Admin
   */
  {
    path: '/admin-panel',
    element: (
      <ProtectedRoute allowedRoles={['admin']}>
        <Layout>
          <AdminPanel />
        </Layout>
      </ProtectedRoute>
    )
  }
]);
