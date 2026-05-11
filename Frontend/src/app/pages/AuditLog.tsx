/**
 * AuditLog.tsx - Bitácora del Sistema (Solo Admin)
 *
 * Registro completo de todas las acciones realizadas en el sistema.
 * Cada acción importante (login, venta, cambio de contraseña, etc.) queda
 * registrada en la base de datos con usuario, fecha, módulo y descripción.
 *
 * TIPOS DE ACCIONES REGISTRADAS:
 * - LOGIN / LOGOUT:  Inicio y cierre de sesión
 * - CREATE:          Creación de productos, usuarios, etc.
 * - UPDATE:          Modificaciones de datos
 * - DELETE:          Eliminaciones
 * - STOCK:           Ajustes de inventario
 * - VENTA:           Ventas registradas
 * - COMPRA:          Compras a proveedores
 * - RESET_PW:        Cambios de contraseña
 *
 * FILTROS DISPONIBLES:
 * - Búsqueda por texto (usuario, módulo, descripción)
 * - Filtro por tipo de acción
 * - Rango de fechas (desde / hasta)
 */
import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, LogIn, LogOut, Plus, Edit, Trash2, Package, ShoppingCart, Lock, Shield } from 'lucide-react';
import { bitacoraAPI, ApiBitacora } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Helpers visuales ────────────────────────────────────────────────────────

const accionIcon = (accion: string) => {
  switch (accion) {
    case 'LOGIN':    return <LogIn    className="w-4 h-4 text-green-600" />;
    case 'LOGOUT':   return <LogOut   className="w-4 h-4 text-orange-600" />;
    case 'CREATE':   return <Plus     className="w-4 h-4 text-blue-600" />;
    case 'UPDATE':   return <Edit     className="w-4 h-4 text-yellow-600" />;
    case 'DELETE':   return <Trash2   className="w-4 h-4 text-red-600" />;
    case 'STOCK':    return <Package  className="w-4 h-4 text-purple-600" />;
    case 'VENTA':    return <ShoppingCart className="w-4 h-4 text-green-600" />;
    case 'RESET_PW': return <Lock     className="w-4 h-4 text-gray-600" />;
    default:         return <Shield   className="w-4 h-4 text-gray-400" />;
  }
};

const accionBadge = (accion: string) => {
  const map: Record<string, string> = {
    LOGIN:    'bg-green-100 text-green-700',
    LOGOUT:   'bg-orange-100 text-orange-700',
    CREATE:   'bg-blue-100 text-blue-700',
    UPDATE:   'bg-yellow-100 text-yellow-700',
    DELETE:   'bg-red-100 text-red-700',
    STOCK:    'bg-purple-100 text-purple-700',
    VENTA:    'bg-emerald-100 text-emerald-700',
    RESET_PW: 'bg-gray-100 text-gray-700',
  };
  return map[accion] ?? 'bg-gray-100 text-gray-700';
};

const rolBadge = (rol: string) => {
  const map: Record<string, string> = {
    admin:    'bg-purple-100 text-purple-700',
    vendedor: 'bg-blue-100 text-blue-700',
    cliente:  'bg-gray-100 text-gray-700',
  };
  return map[rol] ?? 'bg-gray-100 text-gray-600';
};

const formatFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-BO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const ACCIONES: { value: string; label: string }[] = [
  { value: 'LOGIN',    label: 'Inicio de Sesión'     },
  { value: 'LOGOUT',   label: 'Cierre de Sesión'     },
  { value: 'CREATE',   label: 'Creación'              },
  { value: 'UPDATE',   label: 'Actualización'         },
  { value: 'DELETE',   label: 'Eliminación'           },
  { value: 'STOCK',    label: 'Ajuste de Stock'       },
  { value: 'VENTA',    label: 'Venta'                 },
  { value: 'COMPRA',   label: 'Compra'                },
  { value: 'RESET_PW', label: 'Cambio de Contraseña' },
];

// ── component ─────────────────────────────────────────────────────────────

export function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs]           = useState<ApiBitacora[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchTerm, setSearch]   = useState('');
  const [accionFilter, setAccion] = useState('all');
  const [desde, setDesde]         = useState('');
  const [hasta, setHasta]         = useState('');

  // Obtiene todos los registros de la bitácora desde el backend
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setLogs(await bitacoraAPI.getAll());
    } catch {
      alert('Error al cargar la bitácora');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  // Seguridad extra: ProtectedRoute ya redirige, pero esto evita render accidental
  if (user?.role !== 'admin') return null;

  // Aplica todos los filtros activos (texto, acción, rango de fechas) sobre los logs cargados
  const filtered = logs.filter(l => {
    const matchSearch = !searchTerm || (
      l.usuario_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.modulo.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchAccion = accionFilter === 'all' || l.accion === accionFilter;
    const fecha = new Date(l.fecha);
    const matchDesde = !desde || fecha >= new Date(desde);
    const matchHasta = !hasta || fecha <= new Date(hasta + 'T23:59:59');
    return matchSearch && matchAccion && matchDesde && matchHasta;
  });

  // Cuenta cuántos registros hay de un tipo de acción específico (para las métricas de arriba)
  const count = (a: string) => logs.filter(l => l.accion === a).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bitácora del Sistema</h1>
          <p className="text-gray-600 text-sm sm:text-base">Registro de todas las acciones realizadas en el sistema</p>
        </div>
        <button onClick={fetchLogs} disabled={loading}
          className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refrescar</span>
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Registros', value: logs.length,       color: 'text-gray-900' },
          { label: 'Inicios de Sesión', value: count('LOGIN'),  color: 'text-green-600' },
          { label: 'Ventas',           value: count('VENTA'),   color: 'text-emerald-600' },
          { label: 'Eliminaciones',    value: count('DELETE'),  color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-3 sm:p-5 border border-gray-200">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">{label}</p>
            <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-col gap-3">
          {/* Fila 1: buscador + acción */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Buscar por usuario, módulo o descripción..."
                value={searchTerm} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select value={accionFilter} onChange={e => setAccion(e.target.value)}
                className="w-full md:w-auto pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white appearance-none">
                <option value="all">Todas las acciones</option>
                {ACCIONES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Fila 2: rango de fechas */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-sm text-gray-500 font-medium whitespace-nowrap">Rango de fechas:</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 whitespace-nowrap">Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                  min={desde}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              {(desde || hasta) && (
                <button
                  onClick={() => { setDesde(''); setHasta(''); }}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline whitespace-nowrap"
                >
                  Limpiar fechas
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p>No hay registros que coincidan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">Fecha / Hora</th>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">Usuario</th>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">Acción</th>
                  <th className="hidden md:table-cell py-3 px-4 text-left font-medium text-gray-600">Módulo</th>
                  <th className="hidden sm:table-cell py-3 px-4 text-left font-medium text-gray-600">Descripción</th>
                  <th className="hidden lg:table-cell py-3 px-4 text-left font-medium text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs sm:text-sm">
                      {formatFecha(log.fecha)}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{log.usuario_nombre || '—'}</p>
                      {log.usuario_rol && (
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${rolBadge(log.usuario_rol)}`}>
                          {log.usuario_rol}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {accionIcon(log.accion)}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${accionBadge(log.accion)}`}>
                          {log.accion_display || log.accion}
                        </span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell py-3 px-4 text-gray-600">{log.modulo}</td>
                    <td className="hidden sm:table-cell py-3 px-4 text-gray-700 max-w-xs">{log.descripcion}</td>
                    <td className="hidden lg:table-cell py-3 px-4 text-gray-400 text-xs">{log.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
