import { useState, useEffect } from 'react';
import { Package, DollarSign, Clock, ChevronDown, ChevronUp, CheckCircle, Banknote, CreditCard, QrCode } from 'lucide-react';
import { ventasAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface VentaDetail {
  id: number;
  cliente: number;
  cliente_name: string;
  vendedor: number;
  vendedor_name: string;
  total: number;
  status: string;
  fecha: string;
  detalles: Array<{
    id: number;
    producto_name: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  pagos: Array<{
    id: number;
    monto: number;
    metodo: string;
    fecha: string;
  }>;
}

interface HistorialData {
  total_ventas: number;
  total_monto: number;
  ventas: VentaDetail[];
}

type Filtro = 'todas' | 'completadas' | 'pendientes';

export function SalesHistory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canComplete = user?.role === 'admin' || user?.role === 'employee';

  const [historialData, setHistorialData] = useState<HistorialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedVenta, setExpandedVenta] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (user) cargarHistorial();
  }, [user]);

  const cargarHistorial = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Tanto admin como empleado ven TODAS las ventas
      // (el empleado necesita ver pedidos de clientes con vendedor=null)
      const ventas = await ventasAPI.getAll() as unknown as VentaDetail[];
      const total_monto = ventas.reduce((s, v) => s + (Number(v.total) || 0), 0);
      setHistorialData({ total_ventas: ventas.length, total_monto, ventas });
    } catch (error) {
      console.error('Error cargando historial:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (ventaId: number, nuevoEstado: string) => {
    setUpdatingId(ventaId);
    try {
      await ventasAPI.update(ventaId, { status: nuevoEstado } as any);
      await cargarHistorial();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      alert('Error al actualizar el estado de la venta');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; classes: string }> = {
      completed: { label: 'Completada', classes: 'bg-green-100 text-green-800' },
      pending:   { label: 'Pendiente',  classes: 'bg-yellow-100 text-yellow-800' },
    };
    const s = map[status] ?? { label: status, classes: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium mr-4 ${s.classes}`}>
        {s.label}
      </span>
    );
  };

  const formatMetodo = (metodo: string) => {
    if (metodo === 'efectivo') return 'Efectivo';
    if (metodo === 'tarjeta')  return 'Tarjeta';
    if (metodo === 'transferencia') return 'QR / Transferencia';
    return metodo;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando historial de ventas...</p>
        </div>
      </div>
    );
  }

  if (!historialData || historialData.ventas.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
          <p className="text-gray-600">Control de ventas y pedidos</p>
        </div>
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No hay ventas registradas aún</p>
          <p className="text-sm text-gray-500">Las ventas aparecerán aquí automáticamente</p>
        </div>
      </div>
    );
  }

  const ventasFiltradas = historialData.ventas.filter(venta => {
    if (filtro === 'todas')       return true;
    if (filtro === 'completadas') return venta.status === 'completed';
    if (filtro === 'pendientes')  return venta.status === 'pending';
    return true;
  });

  const tabs: { key: Filtro; label: string; activeClass: string }[] = [
    { key: 'todas',       label: 'Todas',       activeClass: 'bg-blue-600 text-white' },
    { key: 'completadas', label: 'Completadas',  activeClass: 'bg-green-600 text-white' },
    { key: 'pendientes',  label: 'Pendientes',   activeClass: 'bg-yellow-600 text-white' },
  ];

  // Totales por método de pago (solo para admin)
  const totalEfectivo     = historialData.ventas.reduce((s, v) => s + v.pagos.filter(p => p.metodo === 'efectivo').reduce((a, p) => a + (Number(p.monto) || 0), 0), 0);
  const totalTarjeta      = historialData.ventas.reduce((s, v) => s + v.pagos.filter(p => p.metodo === 'tarjeta').reduce((a, p) => a + (Number(p.monto) || 0), 0), 0);
  const totalTransferencia = historialData.ventas.reduce((s, v) => s + v.pagos.filter(p => p.metodo === 'transferencia').reduce((a, p) => a + (Number(p.monto) || 0), 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historial de Ventas</h1>
        <p className="text-gray-600">Control de ventas y pedidos</p>
      </div>

      {/* Estadísticas — solo admin */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total de Ventas</p>
                  <p className="text-2xl font-bold text-gray-900">{historialData.total_ventas}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Monto Total</p>
                  <p className="text-2xl font-bold text-gray-900">{(Number(historialData.total_monto) || 0).toFixed(2)} Bs</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Promedio por Venta</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {historialData.total_ventas > 0
                      ? ((Number(historialData.total_monto) || 0) / historialData.total_ventas).toFixed(2)
                      : '0.00'} Bs
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Totales por método de pago */}
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recaudado por método de pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <Banknote className="w-8 h-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Efectivo</p>
                  <p className="text-lg font-bold text-green-700">{totalEfectivo.toFixed(2)} Bs</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <QrCode className="w-8 h-8 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">QR / Transferencia</p>
                  <p className="text-lg font-bold text-blue-700">{totalTransferencia.toFixed(2)} Bs</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <CreditCard className="w-8 h-8 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Tarjeta</p>
                  <p className="text-lg font-bold text-purple-700">{totalTarjeta.toFixed(2)} Bs</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Filtros — visibles para todos */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex gap-2 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFiltro(tab.key)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filtro === tab.key ? tab.activeClass : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Ventas */}
      <div className="space-y-4">
        {ventasFiltradas.map(venta => (
          <div key={venta.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">

            {/* Header de la Venta */}
            <button
              onClick={() => setExpandedVenta(expandedVenta === venta.id ? null : venta.id)}
              className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Venta #</p>
                    <p className="font-semibold text-gray-900">{venta.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Cliente</p>
                    <p className="font-semibold text-gray-900">{venta.cliente_name || 'General'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Fecha</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(venta.fecha).toLocaleDateString('es-BO')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 mb-1">Total</p>
                    <p className="font-bold text-lg text-green-600">{(Number(venta.total) || 0).toFixed(2)} Bs</p>
                  </div>
                </div>
              </div>
              <div className="ml-4 flex flex-col items-end gap-1">
                <div className="flex items-center">
                  {getStatusBadge(venta.status)}
                  {expandedVenta === venta.id
                    ? <ChevronUp className="w-5 h-5 text-gray-600" />
                    : <ChevronDown className="w-5 h-5 text-gray-600" />
                  }
                </div>
                {venta.status === 'pending' && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-2 py-0.5">
                    Validación Manual
                  </span>
                )}
              </div>
            </button>

            {/* Botón Completar — admin o empleado, solo ventas pendientes */}
            {canComplete && venta.status === 'pending' && (
              <div className="px-6 pb-4 flex items-center gap-3 border-t border-gray-100 pt-3">
                <button
                  onClick={() => handleUpdateStatus(venta.id, 'completed')}
                  disabled={updatingId === venta.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Completar
                </button>
                {updatingId === venta.id && (
                  <span className="text-xs text-gray-400">Actualizando...</span>
                )}
              </div>
            )}

            {/* Detalles Expandidos */}
            {expandedVenta === venta.id && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Información General */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Información General</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cliente:</span>
                        <span className="font-medium text-gray-900">{venta.cliente_name || 'General'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vendedor:</span>
                        <span className="font-medium text-gray-900">{venta.vendedor_name || 'Pedido online'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fecha:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(venta.fecha).toLocaleDateString('es-BO')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hora:</span>
                        <span className="font-medium text-gray-900">
                          {new Date(venta.fecha).toLocaleTimeString('es-BO')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Método de Pago */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Método de Pago</h3>
                    {venta.pagos.length > 0 ? (
                      <div className="space-y-2 text-sm">
                        {venta.pagos.map(pago => (
                          <div key={pago.id}>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Método:</span>
                              <span className="font-medium text-gray-900">{formatMetodo(pago.metodo)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Monto:</span>
                              <span className="font-medium text-gray-900">{(Number(pago.monto) || 0).toFixed(2)} Bs</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No hay información de pago</p>
                    )}
                  </div>
                </div>

                {/* Productos Vendidos */}
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Productos Vendidos</h3>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-2 text-gray-700">Producto</th>
                          <th className="text-center px-4 py-2 text-gray-700">Cantidad</th>
                          <th className="text-right px-4 py-2 text-gray-700">Precio Unit.</th>
                          <th className="text-right px-4 py-2 text-gray-700">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venta.detalles.map(detalle => (
                          <tr key={detalle.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-900 font-medium">{detalle.producto_name}</td>
                            <td className="text-center px-4 py-2 text-gray-700">{detalle.cantidad}</td>
                            <td className="text-right px-4 py-2 text-gray-700">{(Number(detalle.precio_unitario) || 0).toFixed(2)} Bs</td>
                            <td className="text-right px-4 py-2 font-semibold text-gray-900">
                              {(Number(detalle.subtotal) || 0).toFixed(2)} Bs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total */}
                  <div className="mt-4 flex justify-end">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 min-w-[300px]">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-700">Subtotal:</span>
                        <span className="font-medium text-gray-900">
                          {venta.detalles.reduce((sum, d) => sum + (Number(d.subtotal) || 0), 0).toFixed(2)} Bs
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-blue-200">
                        <span className="font-semibold text-gray-900">Total:</span>
                        <span className="text-xl font-bold text-blue-600">{(Number(venta.total) || 0).toFixed(2)} Bs</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {ventasFiltradas.length === 0 && (
          <div className="bg-white rounded-xl p-8 border border-gray-200 text-center text-gray-500">
            No hay ventas con el filtro seleccionado.
          </div>
        )}
      </div>
    </div>
  );
}
