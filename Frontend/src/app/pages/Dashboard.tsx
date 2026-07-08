/**
 * Dashboard.tsx - Panel Principal del Administrador
 *
 * Muestra un resumen visual completo del estado del negocio.
 * Solo accesible para el rol 'admin'.
 *
 * DATOS QUE MUESTRA:
 * - Tarjetas de métricas: productos, clientes, ventas, entregas pendientes,
 *   ingresos, ganancia, ticket promedio, por cobrar, mora, compras, inventario, stock bajo
 * - Gráfico de barras: ventas por mes
 * - Panel: Top clientes (quién compra más, con badge VIP)
 * - Lista: top 5 productos más vendidos
 * - Widget: servicio técnico por estado
 * - Alerta: productos con stock bajo
 *
 * CÓMO SE CALCULA LA GANANCIA:
 * Por cada detalle de venta completada: (precio_venta - precio_compra) × cantidad
 */
import { useEffect, useState } from 'react';
import {
  Package, DollarSign, AlertTriangle, ShoppingCart, BadgeDollarSign, TruckIcon, Boxes,
  Users, Receipt, CreditCard, AlertOctagon, Clock, Wrench, Crown,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  productosAPI, ventasAPI, detallesVentaAPI, comprasAPI, devolucionesAPI,
  clientesAPI, creditoAPI, servicioTecnicoAPI,
  ApiProduct, ApiVenta, ApiDetalleVenta, ApiCompra, ApiCliente, ApiCartera, ApiOrdenServicio,
} from '../services/api';

export function Dashboard() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [ventas, setVentas] = useState<ApiVenta[]>([]);
  const [detalles, setDetalles] = useState<ApiDetalleVenta[]>([]);
  const [compras, setCompras] = useState<ApiCompra[]>([]);
  const [devoluciones, setDevoluciones] = useState<any[]>([]);
  const [clientes, setClientes] = useState<ApiCliente[]>([]);
  const [cartera, setCartera] = useState<ApiCartera | null>(null);
  const [ordenes, setOrdenes] = useState<ApiOrdenServicio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cada llamada atrapa su propio error → si una falla, el resto del panel igual carga.
    Promise.all([
      productosAPI.getAll().catch(() => [] as ApiProduct[]),
      ventasAPI.getAll().catch(() => [] as ApiVenta[]),
      detallesVentaAPI.getAll().catch(() => [] as ApiDetalleVenta[]),
      comprasAPI.getAll().catch(() => [] as ApiCompra[]),
      devolucionesAPI.list().catch(() => [] as any[]),
      clientesAPI.getAll().catch(() => [] as ApiCliente[]),
      creditoAPI.cartera().catch(() => null),
      servicioTecnicoAPI.ordenes().catch(() => [] as ApiOrdenServicio[]),
    ]).then(([p, v, d, c, dev, cl, cart, ord]) => {
      setProducts(p);
      setVentas(v);
      setDetalles(d);
      setCompras(c);
      setDevoluciones(dev);
      setClientes(cl);
      setCartera(cart);
      setOrdenes(ord);
    }).finally(() => setLoading(false));
  }, []);

  const lowStock = products.filter(p => p.is_low_stock);
  const totalRevenue = ventas.reduce((s, v) => s + parseFloat(String(v.total ?? 0)), 0);
  const totalDevoluciones = devoluciones
    .filter((d: any) => d.estado === 'aprobada')
    .reduce((s: number, d: any) => s + (Number(d.monto_reembolso) || 0), 0);
  const ingresosNetos = totalRevenue - totalDevoluciones;

  const ganancia = ventas
    .filter(v => v.status === 'completed')
    .flatMap(v => v.detalles ?? [])
    .reduce((sum, d) => {
      const product = products.find(p => p.id === d.producto);
      const pCompra = parseFloat(String(product?.precio_compra ?? 0));
      const pVenta  = parseFloat(String(d.precio_unitario));
      return sum + (pVenta - pCompra) * d.cantidad;
    }, 0);

  // KPIs nuevos
  const ticketPromedio = ventas.length ? totalRevenue / ventas.length : 0;
  const entregasPendientes = ventas.filter(v => v.status === 'pending').length;
  const porCobrar = Number(cartera?.resumen?.por_cobrar ?? 0);
  const enMora = Number(cartera?.resumen?.en_mora ?? 0);

  const monthlyMap: Record<string, number> = {};
  ventas.forEach(v => {
    const mes = new Date(v.fecha).toLocaleString('es-BO', { month: 'short' });
    monthlyMap[mes] = (monthlyMap[mes] ?? 0) + parseFloat(String(v.total ?? 0));
  });
  const monthlySales = Object.entries(monthlyMap).map(([month, ventas]) => ({ month, ventas: parseFloat(ventas.toFixed(2)) }));

  const productQtyMap: Record<number, { name: string; qty: number }> = {};
  detalles.forEach(d => {
    if (!productQtyMap[d.producto]) {
      const p = products.find(x => x.id === d.producto);
      productQtyMap[d.producto] = { name: p?.name ?? `#${d.producto}`, qty: 0 };
    }
    productQtyMap[d.producto].qty += d.cantidad;
  });
  const topProducts = Object.values(productQtyMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Top clientes: quién compra más (suma de sus ventas) + nº de compras + badge VIP.
  const vipSet = new Set(clientes.filter(c => c.es_vip).map(c => c.id));
  const clienteStats: Record<string, { nombre: string; monto: number; compras: number; cliente: number }> = {};
  ventas.forEach(v => {
    if (v.cliente == null) return; // ventas de mostrador sin cliente asociado
    const key = String(v.cliente);
    const s = clienteStats[key] ?? { nombre: v.cliente_name || `Cliente #${v.cliente}`, monto: 0, compras: 0, cliente: v.cliente };
    s.monto += parseFloat(String(v.total ?? 0));
    s.compras += 1;
    if (v.cliente_name) s.nombre = v.cliente_name;
    clienteStats[key] = s;
  });
  const topClientes = Object.values(clienteStats)
    .map(s => ({ ...s, vip: vipSet.has(s.cliente) }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5);

  // Servicio técnico por estado
  const ordenPorEstado: Record<string, number> = {};
  ordenes.forEach(o => { ordenPorEstado[o.estado] = (ordenPorEstado[o.estado] ?? 0) + 1; });
  const servicioEstados = [
    { key: 'solicitado', label: 'Solicitadas', cls: 'bg-gray-100 text-gray-700' },
    { key: 'agendado',   label: 'Agendadas',   cls: 'bg-yellow-100 text-yellow-700' },
    { key: 'en_proceso', label: 'En proceso',  cls: 'bg-blue-100 text-blue-700' },
    { key: 'finalizado', label: 'Finalizadas', cls: 'bg-green-100 text-green-700' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const totalCompras = compras.reduce((s, c) => s + Number(c.monto_total ?? 0), 0);
  const valorInventario = products.reduce((s, p) => s + (Number(p.precio_venta ?? 0) * Number(p.stock ?? 0)), 0);

  const stats = [
    { label: 'Total Productos',      value: products.length,                     icon: Package,         color: 'bg-blue-500'    },
    { label: 'Total Clientes',       value: clientes.length,                     icon: Users,           color: 'bg-teal-500'    },
    { label: 'Total Ventas',         value: ventas.length,                       icon: ShoppingCart,    color: 'bg-purple-500'  },
    { label: 'Entregas Pendientes',  value: entregasPendientes,                  icon: Clock,           color: 'bg-violet-500'  },
    { label: 'Ingresos Netos',       value: `${ingresosNetos.toFixed(2)} Bs`,    icon: DollarSign,      color: 'bg-green-500'   },
    { label: 'Ganancia Neta',        value: `${ganancia.toFixed(2)} Bs`,         icon: BadgeDollarSign, color: 'bg-emerald-600' },
    { label: 'Ticket Promedio',      value: `${ticketPromedio.toFixed(2)} Bs`,   icon: Receipt,         color: 'bg-cyan-600'    },
    { label: 'Por Cobrar',           value: `${porCobrar.toFixed(2)} Bs`,        icon: CreditCard,      color: 'bg-amber-500'   },
    { label: 'En Mora',              value: `${enMora.toFixed(2)} Bs`,           icon: AlertOctagon,    color: 'bg-red-600'     },
    { label: 'Total Compras',        value: `${totalCompras.toFixed(2)} Bs`,     icon: TruckIcon,       color: 'bg-sky-500'     },
    { label: 'Valor Inventario',     value: `${valorInventario.toFixed(2)} Bs`,  icon: Boxes,           color: 'bg-indigo-500'  },
    { label: 'Stock Bajo',           value: lowStock.length,                     icon: AlertTriangle,   color: 'bg-orange-500'  },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen general del sistema</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5 truncate">{stat.label}</p>
                  <p className="text-lg font-bold text-gray-900 truncate">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-2 rounded-lg flex-shrink-0 ml-2`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ventas por Mes</h2>
          {monthlySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v: number) => [`${v} Bs`, 'Ventas']} />
                <Bar dataKey="ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400">Sin datos de ventas</div>
          )}
        </div>

        {/* Top clientes: reemplaza el antiguo gráfico "Ventas por Marca" */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Clientes que más compran</h2>
          </div>
          {topClientes.length > 0 ? (
            <div className="space-y-3">
              {topClientes.map((c, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                    index === 0 ? 'bg-amber-100 text-amber-700'
                    : index === 1 ? 'bg-gray-200 text-gray-700'
                    : index === 2 ? 'bg-orange-100 text-orange-700'
                    : 'bg-teal-50 text-teal-700'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                      {c.nombre}
                      {c.vip && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold flex-shrink-0">
                          <Crown className="w-3 h-3" /> VIP
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{c.compras} compra{c.compras !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-semibold whitespace-nowrap">
                    {c.monto.toFixed(2)} Bs
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400">Sin datos de clientes</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Productos Más Vendidos</h2>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {item.qty} vendidos
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">Sin ventas registradas</div>
          )}
        </div>

        {/* Servicio técnico por estado (CU25-27) */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-900">Servicio Técnico</h2>
            </div>
            <span className="text-sm text-gray-500">{ordenes.length} órden{ordenes.length !== 1 ? 'es' : ''}</span>
          </div>
          {ordenes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {servicioEstados.map(e => (
                <div key={e.key} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.cls}`}>{e.label}</span>
                  <span className="text-2xl font-bold text-gray-900">{ordenPorEstado[e.key] ?? 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">Sin órdenes de servicio</div>
          )}
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-300">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-6 h-6 text-orange-600 animate-pulse" />
            <h2 className="text-lg font-bold text-orange-900">Stock Bajo — {lowStock.length} producto(s)</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {lowStock.map(p => (
              <div key={p.id} className="bg-white rounded-lg px-4 py-3 border-l-4 border-orange-500 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                  {p.marca && <p className="text-xs text-gray-500">{p.marca}</p>}
                </div>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold text-xs">
                  Stock: {p.stock ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
