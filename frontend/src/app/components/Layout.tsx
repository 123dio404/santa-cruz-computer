/**
 * Layout.tsx - Estructura Principal de la Aplicación
 * 
 * Este componente proporciona:
 * 1. Sidebar: Menú de navegación lateral
 * 2. Header: Barra superior con usuario y notificaciones
 * 3. Main Content: Área donde se muestran las páginas
 * 
 * CAMPANA DE NOTIFICACIONES (🔔):
 * - Solo visible para: Admin y Empleado
 * - Muestra: Número de productos con stock bajo
 * - Al hacer click: Despliega lista detallada
 * - Actualiza en tiempo real basado en mockProducts
 */

import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { mockProducts } from '../data/mockData';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  LogOut,
  Menu,
  X,
  Store,
  Warehouse,
  UserCircle,
  Building2,
  Bell,
  AlertTriangle
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Calcular productos con stock bajo
  const lowStockProducts = mockProducts.filter(p => p.stock <= p.minStock);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (!user) return [];

    const adminItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/products', icon: Package, label: 'Productos' },
      { path: '/inventory', icon: Warehouse, label: 'Inventario' },
      { path: '/sales', icon: ShoppingCart, label: 'Ventas' },
      { path: '/customers', icon: UserCircle, label: 'Clientes' },
      { path: '/suppliers', icon: Building2, label: 'Proveedores' },
      { path: '/users', icon: Users, label: 'Usuarios' }
    ];

    const employeeItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/inventory', icon: Warehouse, label: 'Inventario' },
      { path: '/sales', icon: ShoppingCart, label: 'Ventas' },
      { path: '/customers', icon: UserCircle, label: 'Clientes' }
    ];

    const clientItems = [
      { path: '/store', icon: Store, label: 'Tienda' },
      { path: '/cart', icon: ShoppingCart, label: 'Carrito' },
      { path: '/orders', icon: Package, label: 'Mis Pedidos' }
    ];

    if (user.role === 'admin') return adminItems;
    if (user.role === 'employee') return employeeItems;
    return clientItems;
  };

  const navItems = getNavItems();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform duration-300 lg:translate-x-0 lg:static`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h1 className="font-bold text-xl">TechStore</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="px-4 py-3 mb-2 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-xl font-semibold text-gray-900">
                Bienvenido, {user?.name}
              </h2>
            </div>

            {/* Notifications Bell - Only for Admin and Employee */}
            {user?.role === 'admin' || user?.role === 'employee' ? (
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Notificaciones de Stock Bajo"
                >
                  <Bell className="w-6 h-6" />
                  {lowStockProducts.length > 0 && (
                    <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      {lowStockProducts.length}
                    </span>
                  )}
                </button>

                {/* Dropdown Menu */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <h3 className="font-bold text-gray-900">
                          Alertas de Stock ({lowStockProducts.length})
                        </h3>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Productos por debajo del stock mínimo</p>
                    </div>

                    {lowStockProducts.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        ✓ Todo el stock está en nivel óptimo
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {lowStockProducts.map(product => (
                          <div
                            key={product.id}
                            className="p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <div className="flex gap-3">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-12 h-12 rounded object-cover"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-sm text-gray-900">{product.name}</p>
                                <p className="text-xs text-gray-600">{product.category}</p>
                                <div className="flex gap-2 mt-1">
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                                    Stock: {product.stock}
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                    Mín: {product.minStock}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                      <Link
                        to="/inventory"
                        onClick={() => setNotificationsOpen(false)}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors text-center block"
                      >
                        Ver Inventario Completo
                      </Link>
                    </div>
                  </div>
                )}

                {/* Overlay para cerrar dropdown */}
                {notificationsOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotificationsOpen(false)}
                  />
                )}
              </div>
            ) : null}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
