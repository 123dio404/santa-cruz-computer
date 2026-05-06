import { useState, useEffect } from 'react';
import { Users, Eye, X, DollarSign, RefreshCw } from 'lucide-react';
import { ventasAPI, ApiUser, ApiVenta } from '../services/api';
import { useUsers } from '../context/UsersContext';

export function Customers() {
  const { clients, loading, fetchUsers: loadClients } = useUsers();

  useEffect(() => { loadClients(); }, []);

  const [selectedClient, setSelectedClient] = useState<ApiUser | null>(null);
  const [clientVentas, setClientVentas] = useState<ApiVenta[]>([]);
  const [loadingVentas, setLoadingVentas] = useState(false);

  const handleViewClient = async (client: ApiUser) => {
    setSelectedClient(client);
    setLoadingVentas(true);
    try {
      const v = await ventasAPI.getByCliente(client.id);
      setClientVentas(v);
    } catch {
      setClientVentas([]);
    } finally {
      setLoadingVentas(false);
    }
  };

  const totalVentas = (ventas: ApiVenta[]) =>
    ventas.reduce((s, v) => s + parseFloat(String(v.total ?? 0)), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600">Gestión de clientes registrados</p>
        </div>
        <button onClick={loadClients} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Clientes Activos</p>
              <p className="text-2xl font-bold text-gray-900">{clients.filter(c => c.activo).length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
          No hay clientes registrados.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Nombre</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Teléfono</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Registro</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4 font-medium text-gray-900">{client.name}</td>
                    <td className="py-4 px-4 text-gray-600">{client.email}</td>
                    <td className="py-4 px-4 text-gray-600">{client.telefono || '—'}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${client.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {client.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-gray-600 text-sm">
                      {client.created_at ? new Date(client.created_at).toLocaleDateString('es-BO') : '—'}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button onClick={() => handleViewClient(client)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                        <Eye className="w-4 h-4" /> Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedClient.name}</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedClient.email}</p>
              </div>
              <button onClick={() => setSelectedClient(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Teléfono</p>
                  <p className="font-medium text-gray-900">{selectedClient.telefono || '—'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Estado</p>
                  <p className="font-medium text-gray-900">{selectedClient.activo ? 'Activo' : 'Inactivo'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total compras</p>
                  <p className="text-xl font-bold text-gray-900">{totalVentas(clientVentas).toFixed(2)} Bs</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Nro. pedidos</p>
                  <p className="text-xl font-bold text-gray-900">{clientVentas.length}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Historial de Compras</h3>
                {loadingVentas ? (
                  <div className="text-center py-6 text-gray-400">Cargando...</div>
                ) : clientVentas.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">Sin compras registradas</div>
                ) : (
                  <div className="space-y-3">
                    {clientVentas.map(v => (
                      <div key={v.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">Venta #{v.id}</p>
                            <p className="text-sm text-gray-600">{new Date(v.fecha).toLocaleDateString('es-BO')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">{parseFloat(String(v.total)).toFixed(2)} Bs</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${v.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {v.status}
                            </span>
                          </div>
                        </div>
                        {v.detalles && v.detalles.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-gray-100 text-sm text-gray-600">
                            {v.detalles.map(d => (
                              <span key={d.id} className="mr-3">{d.producto_name} x{d.cantidad}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
