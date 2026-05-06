import { useState, useEffect } from 'react';
import { Package, Eye, X } from 'lucide-react';
import { ventasAPI, ApiVenta } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ApiVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ApiVenta | null>(null);

  useEffect(() => {
    if (!user) return;
    ventasAPI.getByCliente(parseInt(user.id))
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
      processing: { label: 'Procesando', color: 'bg-blue-100 text-blue-700' },
      completed: { label: 'Completado', color: 'bg-green-100 text-green-700' },
      cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    };
    const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' };
    return <span className={`px-3 py-1 rounded-full text-sm font-medium ${s.color}`}>{s.label}</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pedidos</h1>
        <p className="text-gray-600">Historial de compras y seguimiento</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes pedidos aún</h3>
          <p className="text-gray-600">Tus compras aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">Pedido #{order.id}</h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    Fecha: {new Date(order.fecha).toLocaleDateString('es-BO')}
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-xl font-bold text-gray-900">{parseFloat(String(order.total)).toFixed(2)} Bs</p>
                  </div>
                  <button onClick={() => setSelectedOrder(order)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Eye className="w-4 h-4" /> Ver Detalles
                  </button>
                </div>
              </div>

              {order.detalles && order.detalles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  {order.detalles.map(d => (
                    <span key={d.id} className="text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded">
                      {d.producto_name} × {d.cantidad}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Detalles del Pedido</h2>
                <p className="text-sm text-gray-600 mt-1">#{selectedOrder.id}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Estado</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha</p>
                  <p className="font-medium text-gray-900">{new Date(selectedOrder.fecha).toLocaleDateString('es-BO')}</p>
                </div>
              </div>

              {selectedOrder.detalles && selectedOrder.detalles.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Productos</h3>
                  <div className="space-y-3">
                    {selectedOrder.detalles.map(d => (
                      <div key={d.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                        <div className="w-14 h-14 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-blue-300" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{d.producto_name}</h4>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm text-gray-600">Cantidad: {d.cantidad}</span>
                            <span className="font-semibold text-gray-900">{parseFloat(String(d.subtotal)).toFixed(2)} Bs</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.pagos && selectedOrder.pagos.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Pago</h3>
                  {selectedOrder.pagos.map(p => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 capitalize">{p.metodo}</span>
                      <span className="font-medium">{parseFloat(String(p.monto)).toFixed(2)} Bs</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total</span>
                <span className="text-2xl font-bold text-gray-900">{parseFloat(String(selectedOrder.total)).toFixed(2)} Bs</span>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Estado del pedido</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {selectedOrder.status === 'completed'
                      ? 'Tu pedido ha sido confirmado y pagado'
                      : selectedOrder.status === 'pending'
                      ? 'Hemos recibido tu pedido, en espera de confirmación'
                      : `Estado: ${selectedOrder.status}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
