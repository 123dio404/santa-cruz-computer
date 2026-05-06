import { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, LogIn, LogOut, Plus, Edit, Trash2, Package, ShoppingCart, Lock, Shield } from 'lucide-react';
import { bitacoraAPI, ApiBitacora } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── helpers ────────────────────────────────────────────────────────────────

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

const ACCIONES = ['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'STOCK', 'VENTA', 'RESET_PW'];

// ── component ─────────────────────────────────────────────────────────────

export function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs]           = useState<ApiBitacora[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchTerm, setSearch]   = useState('');
  const [accionFilter, setAccion] = useState('all');

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

  // admin-only guard (ProtectedRoute already handles redirect; this is defense-in-depth)
  if (user?.role !== 'admin') return null;

  const filtered = logs.filter(l => {
    const matchSearch = !searchTerm || (
      l.usuario_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.modulo.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchAccion = accionFilter === 'all' || l.accion === accionFilter;
    return matchSearch && matchAccion;
  });

  // stats
  const count = (a: string) => logs.filter(l => l.accion === a).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bitácora del Sistema</h1>
          <p className="text-gray-600">Registro de todas las acciones realizadas en el sistema</p>
        </div>
        <button onClick={fetchLogs} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Registros', value: logs.length,       color: 'text-gray-900' },
          { label: 'Inicios de Sesión', value: count('LOGIN'),  color: 'text-green-600' },
          { label: 'Ventas',           value: count('VENTA'),   color: 'text-emerald-600' },
          { label: 'Eliminaciones',    value: count('DELETE'),  color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
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
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white appearance-none">
              <option value="all">Todas las acciones</option>
              {ACCIONES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
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
                  <th className="py-3 px-4 text-left font-medium text-gray-600">Módulo</th>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">Descripción</th>
                  <th className="py-3 px-4 text-left font-medium text-gray-600">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
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
                    <td className="py-3 px-4 text-gray-600">{log.modulo}</td>
                    <td className="py-3 px-4 text-gray-700 max-w-xs">{log.descripcion}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{log.ip_address || '—'}</td>
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
