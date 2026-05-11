/**
 * Dashboard.tsx - Panel Principal del Administrador
 *
 * Muestra un resumen visual completo del estado del negocio.
 * Solo accesible para el rol 'admin'.
 *
 * DATOS QUE MUESTRA:
 * - Tarjetas de métricas: productos, ingresos, ganancia, ventas, compras, inventario, stock bajo
 * - Gráfico de barras: ventas por mes
 * - Gráfico de torta: ventas por marca
 * - Lista: top 5 productos más vendidos
 * - Alerta: productos con stock bajo
 *
 * CÓMO SE CALCULA LA GANANCIA:
 * Por cada detalle de venta completada: (precio_venta - precio_compra) × cantidad
 */
import { useEffect, useState } from 'react';
import { Package, DollarSign, AlertTriangle, ShoppingCart, BadgeDollarSign, TruckIcon, Boxes } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { productosAPI, ventasAPI, detallesVentaAPI, comprasAPI, ApiProduct, ApiVenta, ApiDetalleVenta, ApiCompra } from '../services/api';

export function Dashboard() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [ventas, setVentas] = useState<ApiVenta[]>([]);
  const [detalles, setDetalles] = useState<ApiDetalleVenta[]>([]);
  const [compras, setCompras] = useState<ApiCompra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      productosAPI.getAll(),
      ventasAPI.getAll(),
      detallesVentaAPI.getAll(),
      comprasAPI.getAll(),
    ]).then(([p, v, d, c]) => {
      setProducts(p);
      setVentas(v);
      setDetalles(d);
      setCompras(c);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const lowStock = products.filter(p => p.is_low_stock);
  const totalRevenue = ventas.reduce((s, v) => s + parseFloat(String(v.total ?? 0)), 0);

  const ganancia = ventas
    .filter(v => v.status === 'completed')
    .flatMap(v => v.detalles ?? [])
    .reduce((sum, d) => {
      const product = products.find(p => p.id === d.producto);
      const pCompra = parseFloat(String(product?.precio_compra ?? 0));
      const pVenta  = parseFloat(String(d.precio_unitario));
      return sum + (pVenta - pCompra) * d.cantidad;
    }, 0);

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

  const marcaMap: Record<string, number> = {};
  detalles.forEach(d => {
    const p = products.find(x => x.id === d.producto);
    const label = p?.marca || p?.estado || 'Otros';
    marcaMap[label] = (marcaMap[label] ?? 0) + parseFloat(String(d.subtotal ?? 0));
  });
  const categoryChartData = Object.entries(marcaMap).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const totalCompras = compras.reduce((s, c) => s + Number(c.monto_total ?? 0), 0);
  const valorInventario = products.reduce((s, p) => s + (Number(p.precio_venta ?? 0) * Number(p.stock ?? 0)), 0);

  const stats = [
    { label: 'Total Productos',   value: products.length,                    icon: Package,         color: 'bg-blue-500'    },
    { label: 'Ingresos Totales',  value: `${totalRevenue.toFixed(2)} Bs`,    icon: DollarSign,      color: 'bg-green-500'   },
    { label: 'Ganancia Neta',     value: `${ganancia.toFixed(2)} Bs`,        icon: BadgeDollarSign, color: 'bg-emerald-600' },
    { label: 'Total Ventas',      value: ventas.length,                      icon: ShoppingCart,    color: 'bg-purple-500'  },
    { label: 'Total Compras',     value: `${totalCompras.toFixed(2)} Bs`,    icon: TruckIcon,       color: 'bg-sky-500'     },
    { label: 'Valor Inventario',  value: `${valorInventario.toFixed(2)} Bs`, icon: Boxes,           color: 'bg-indigo-500'  },
    { label: 'Stock Bajo',        value: lowStock.length,                    icon: AlertTriangle,   color: 'bg-orange-500'  },
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

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ventas por Marca</h2>
          {categoryChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={categoryChartData} cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  dataKey="value">
                  {categoryChartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} Bs`]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400">Sin datos</div>
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

        {lowStock.length > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-300">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-6 h-6 text-orange-600 animate-pulse" />
              <h2 className="text-lg font-bold text-orange-900">Stock Bajo — {lowStock.length} producto(s)</h2>
            </div>
            <div className="space-y-2">
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
    </div>
  );
}
