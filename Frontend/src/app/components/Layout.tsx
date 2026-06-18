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

import { ReactNode, useState, useEffect, FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useAudit } from '../context/AuditContext';
import { productosAPI, ventasAPI, garantiasAPI, authAPI, clearAuthToken, BACKEND_ROOT_URL, ApiProduct, ApiVenta, ApiGarantia } from '../services/api';
import { VoiceAssistant } from './VoiceAssistant';
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
  AlertTriangle,
  Lock,
  Shield,
  ShieldCheck,
  MessageSquare,
  ClipboardList,
  History,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const { addEvent } = useAudit();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState<ApiProduct[]>([]);
  const [pendingVentas, setPendingVentas]       = useState<ApiVenta[]>([]);
  const [pendingReclamos, setPendingReclamos]   = useState<ApiGarantia[]>([]);
  const [changePwOpen, setChangePwOpen]         = useState(false);
  const [cpCurrent, setCpCurrent]               = useState('');
  const [cpNew, setCpNew]                       = useState('');
  const [cpConfirm, setCpConfirm]               = useState('');
  const [cpError, setCpError]                   = useState('');
  const [cpSuccess, setCpSuccess]               = useState('');
  const [cpLoading, setCpLoading]               = useState(false);
  const [cpShowCurrent, setCpShowCurrent]       = useState(false);
  const [cpShowNew, setCpShowNew]               = useState(false);
  const [cpShowConfirm, setCpShowConfirm]       = useState(false);

  const fetchNotifications = () => {
    if (user?.role !== 'admin' && user?.role !== 'employee') return;
    productosAPI.getAll()
      .then(products => setLowStockProducts(products.filter(p => p.is_low_stock)))
      .catch(() => {});
    ventasAPI.getAll()
      .then(ventas => setPendingVentas(ventas.filter(v => v.status === 'pending')))
      .catch(() => {});
    garantiasAPI.getAll('reclamada')
      .then(setPendingReclamos)
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const totalNotifications = lowStockProducts.length + pendingVentas.length + pendingReclamos.length;

  const handleLogout = () => {
    // Registrar logout en auditoría
    if (user) {
      addEvent({
        timestamp: new Date(),
        eventType: 'logout',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        description: `${user.name} (${user.role}) cerró sesión en el sistema`,
        details: {
          ipAddress: 'APP-CLIENT'
        }
      });
    }
    
    clearAuthToken();
    logout();
    navigate('/login');
  };

  const openChangePw = () => {
    setCpCurrent('');
    setCpNew('');
    setCpConfirm('');
    setCpError('');
    setCpSuccess('');
    setCpShowCurrent(false);
    setCpShowNew(false);
    setCpShowConfirm(false);
    setUserMenuOpen(false);
    setSidebarOpen(false);
    setChangePwOpen(true);
  };

  const handleChangePw = async (e: FormEvent) => {
    e.preventDefault();
    setCpError('');
    setCpSuccess('');
    if (cpNew !== cpConfirm) {
      setCpError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (cpNew.length < 8) {
      setCpError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setCpLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tiempo de espera agotado.')), 8000)
      );
      const res = await Promise.race([authAPI.changePassword(cpCurrent, cpNew), timeout]);
      setCpSuccess(res.message);
      setTimeout(() => setChangePwOpen(false), 1000);
    } catch (err: any) {
      setCpError(err.message || 'Error al cambiar la contraseña.');
      setCpLoading(false);
    }
  };

  const getNavItems = () => {
    if (!user) return [];

    const adminItems = [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/products', icon: Package, label: 'Productos' },
      { path: '/inventory', icon: Warehouse, label: 'Inventario' },
      { path: '/sales', icon: ShoppingCart, label: 'Nueva Venta' },
      { path: '/sales-history', icon: History, label: 'Historial de Ventas' },
      { path: '/suppliers', icon: Building2, label: 'Proveedores' },
      { path: '/warranties', icon: ShieldCheck, label: 'Reclamos de Garantía' },
      { path: '/reviews', icon: MessageSquare, label: 'Reseñas' },
      { path: '/users', icon: Users, label: 'Usuarios' },
      { path: '/audit-log', icon: ClipboardList, label: 'Bitácora' }
    ];

    const employeeItems = [
      { path: '/inventory', icon: Warehouse, label: 'Inventario' },
      { path: '/sales', icon: ShoppingCart, label: 'Nueva Venta' },
      { path: '/sales-history', icon: History, label: 'Historial de Ventas' },
      { path: '/warranties', icon: ShieldCheck, label: 'Reclamos de Garantía' },
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
            <h1 className="font-bold text-xl">SantaCruzComputer</h1>
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
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full px-4 py-3 mb-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg hover:border-blue-300 transition-all cursor-pointer text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    {user?.role === 'admin' && <Shield className="w-3 h-3" />}
                    {user?.role === 'admin' ? 'Administrador' : user?.role === 'employee' ? 'Vendedor' : 'Cliente'}
                  </p>
                </div>
                <UserCircle className="w-5 h-5 text-blue-600" />
              </div>
            </button>

            {/* User Menu Dropdown */}
            {userMenuOpen && (
              <div className="absolute left-4 right-4 bottom-20 bg-white rounded-lg shadow-xl border border-gray-200 z-40 overflow-hidden">
                {/* Admin-only: Panel de Administración */}
                {user?.role === 'admin' && (
                  <Link
                    to="/admin-panel"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setSidebarOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 hover:bg-blue-50 border-b border-gray-200 transition-colors"
                  >
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Panel de Administración</span>
                  </Link>
                )}

                {/* All roles: Cambiar Contraseña */}
                <button
                  onClick={openChangePw}
                  className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 hover:bg-purple-50 border-b border-gray-200 transition-colors text-left"
                >
                  <Lock className="w-4 h-4 text-blue-900" />
                  <span className="font-medium">Cambiar Contraseña</span>
                </button>

                {/* Common: Cerrar sesión */}
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            )}

            {/* Original Logout Button (fallback) */}
            {!userMenuOpen && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Cerrar sesión</span>
              </button>
            )}
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
                  title="Notificaciones"
                >
                  <Bell className="w-6 h-6" />
                  {totalNotifications > 0 && (
                    <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      {totalNotifications}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[80vh] flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-gray-700" />
                        <h3 className="font-bold text-gray-900">Notificaciones</h3>
                        {totalNotifications > 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                            {totalNotifications}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={fetchNotifications}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Actualizar
                      </button>
                    </div>

                    <div className="overflow-y-auto flex-1">
                      {/* ── Sección: Stock Bajo ── */}
                      <div className="border-b border-gray-200">
                        <div className="flex items-center gap-2 px-4 py-2 bg-orange-50">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
                            Stock Bajo ({lowStockProducts.length})
                          </span>
                        </div>
                        {lowStockProducts.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" /> Stock en nivel óptimo
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {lowStockProducts.map(product => (
                              <div key={product.id} className="flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors">
                                {/* Imagen del producto */}
                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200 flex items-center justify-center">
                                  {product.imagen_url
                                    ? <img
                                        src={product.imagen_url.startsWith('http') ? product.imagen_url : `${BACKEND_ROOT_URL}${product.imagen_url}`}
                                        alt={product.name}
                                        className="w-full h-full object-contain p-0.5"
                                      />
                                    : <Package className="w-5 h-5 text-orange-400" />
                                  }
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{[product.marca, product.modelo].filter(Boolean).join(' · ') || 'Sin marca'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                                    {product.stock ?? 0} uds
                                  </span>
                                  <span className="text-xs text-gray-400">mín. {product.stock_minimo}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {lowStockProducts.length > 0 && (
                          <div className="px-4 py-2">
                            <Link
                              to="/inventory"
                              onClick={() => setNotificationsOpen(false)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Ver inventario completo →
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* ── Sección: Pedidos Pendientes ── */}
                      <div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50">
                          <Clock className="w-4 h-4 text-yellow-600" />
                          <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">
                            Pedidos Pendientes ({pendingVentas.length})
                          </span>
                        </div>
                        {pendingVentas.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" /> Sin pedidos pendientes
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {pendingVentas.map(venta => (
                              <Link
                                key={venta.id}
                                to="/sales-history?filtro=pendientes"
                                onClick={() => setNotificationsOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-yellow-50 transition-colors"
                              >
                                <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                                  <Clock className="w-4 h-4 text-yellow-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">
                                    Venta #{venta.id}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {venta.cliente_name || 'Cliente sin nombre'}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {new Date(venta.fecha).toLocaleDateString('es-BO')}
                                    {' · '}
                                    <span className="font-medium text-gray-600">
                                      Bs {parseFloat(String(venta.total)).toFixed(2)}
                                    </span>
                                  </p>
                                </div>
                                <span className="text-xs text-yellow-700 font-medium flex-shrink-0">
                                  Pendiente
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                        {pendingVentas.length > 0 && (
                          <div className="px-4 py-2">
                            <Link
                              to="/sales-history?filtro=pendientes"
                              onClick={() => setNotificationsOpen(false)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Ver todos los pendientes →
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* ── Sección: Reclamos de Garantía ── */}
                      <div className="border-t border-gray-200">
                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                            Reclamos de Garantía ({pendingReclamos.length})
                          </span>
                        </div>
                        {pendingReclamos.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" /> Sin reclamos pendientes
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {pendingReclamos.map(g => (
                              <Link
                                key={g.id}
                                to="/warranties"
                                onClick={() => setNotificationsOpen(false)}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-amber-50 transition-colors"
                              >
                                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {g.producto_nombre}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {g.cliente_nombre || 'Cliente'} · Pedido #{g.venta}
                                  </p>
                                  {g.motivo_reclamo && (
                                    <p className="text-xs text-gray-400 truncate">{g.motivo_reclamo}</p>
                                  )}
                                </div>
                                <span className="text-xs text-amber-700 font-medium flex-shrink-0">
                                  Reclamo
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                        {pendingReclamos.length > 0 && (
                          <div className="px-4 py-2">
                            <Link
                              to="/warranties"
                              onClick={() => setNotificationsOpen(false)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Ver todos los reclamos →
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Overlay */}
                {notificationsOpen && (
                  <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
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

      {/* Asistente de voz para reportes — solo admin */}
      {user?.role === 'admin' && <VoiceAssistant />}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Change Password Modal */}
      {changePwOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Lock className="w-5 h-5 text-blue-900" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Cambiar Contraseña</h2>
              </div>
              <button
                onClick={() => setChangePwOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePw} className="p-6 space-y-4">
              {cpError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {cpError}
                </div>
              )}
              {cpSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                  {cpSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña actual
                </label>
                <div className="relative">
                  <input
                    type={cpShowCurrent ? 'text' : 'password'}
                    value={cpCurrent}
                    onChange={e => setCpCurrent(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    placeholder="Ingresa tu contraseña actual"
                  />
                  <button
                    type="button"
                    onClick={() => setCpShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {cpShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={cpShowNew ? 'text' : 'password'}
                    value={cpNew}
                    onChange={e => setCpNew(e.target.value)}
                    required
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setCpShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {cpShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {cpNew && (
                  <div className="mt-1 flex gap-1">
                    {[
                      cpNew.length >= 8,
                      /[A-Z]/.test(cpNew),
                      /[a-z]/.test(cpNew),
                      /[0-9]/.test(cpNew),
                    ].map((ok, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${ok ? 'bg-green-500' : 'bg-gray-200'}`}
                      />
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo 8 caracteres, mayúscula, minúscula y número
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={cpShowConfirm ? 'text' : 'password'}
                    value={cpConfirm}
                    onChange={e => setCpConfirm(e.target.value)}
                    required
                    className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 ${
                      cpConfirm && cpConfirm !== cpNew ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setCpShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {cpShowConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {cpConfirm && cpConfirm !== cpNew && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setChangePwOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cpLoading || !!cpSuccess}
                  className="flex-1 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cpLoading ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
