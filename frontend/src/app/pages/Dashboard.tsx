import { Package, ShoppingCart, DollarSign, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { mockProducts, mockSales, mockCustomers } from '../data/mockData';

export function Dashboard() {
  // Calculate total profit
  const totalProfit = mockSales.reduce((sum, sale) => {
    const saleProfit = sale.products.reduce((productSum, item) => {
      const product = mockProducts.find(p => p.id === item.productId);
      if (product) {
        const profit = (product.salePrice - product.costPrice) * item.quantity;
        return productSum + profit;
      }
      return productSum;
    }, 0);
    return sum + saleProfit;
  }, 0);

  // Calculate total revenue
  const totalRevenue = mockSales.reduce((sum, sale) => sum + sale.total, 0);

  // Get low stock products
  const lowStock = mockProducts.filter(p => p.stock <= p.minStock);

  // Calculate most sold products
  const productSales: { [key: string]: number } = {};
  mockSales.forEach(sale => {
    sale.products.forEach(item => {
      productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
    });
  });

  const topProducts = Object.entries(productSales)
    .map(([productId, quantity]) => {
      const product = mockProducts.find(p => p.id === productId);
      return { productId, quantity, product };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Calculate most frequent customers
  const customerFrequency: { [key: string]: number } = {};
  mockSales.forEach(sale => {
    customerFrequency[sale.customerId] = (customerFrequency[sale.customerId] || 0) + 1;
  });

  const topCustomers = Object.entries(customerFrequency)
    .map(([customerId, purchases]) => {
      const customer = mockCustomers.find(c => c.id === customerId);
      return { customerId, purchases, customer };
    })
    .sort((a, b) => b.purchases - a.purchases)
    .slice(0, 5);

  // Prepare chart data for sales by category
  const categoryData: { [key: string]: number } = {};
  mockSales.forEach(sale => {
    sale.products.forEach(item => {
      const product = mockProducts.find(p => p.id === item.productId);
      if (product) {
        categoryData[product.category] = (categoryData[product.category] || 0) + (item.price * item.quantity);
      }
    });
  });

  const categoryChartData = Object.entries(categoryData).map(([name, value]) => ({
    name,
    value: parseFloat(value.toFixed(2))
  }));

  // Prepare monthly sales data
  const monthlySales = [
    { month: 'Ene', ventas: 12500 },
    { month: 'Feb', ventas: 15200 },
    { month: 'Mar', ventas: 18900 },
    { month: 'Abr', ventas: totalRevenue }
  ];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const stats = [
    {
      label: 'Total Productos',
      value: mockProducts.length,
      icon: Package,
      color: 'bg-blue-500'
    },
    {
      label: 'Ganancia Total',
      value: `${totalProfit.toFixed(2)} Bs`,
      icon: TrendingUp,
      color: 'bg-green-500'
    },
    {
      label: 'Ventas del Mes',
      value: `${totalRevenue.toFixed(2)} Bs`,
      icon: DollarSign,
      color: 'bg-purple-500'
    },
    {
      label: 'Stock Bajo',
      value: lowStock.length,
      icon: AlertTriangle,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen general del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Sales Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ventas Mensuales</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="ventas" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales by Category Chart */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ventas por Categoría</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products and Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Sold Products */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Productos Más Vendidos</h2>
          </div>
          <div className="space-y-3">
            {topProducts.map((item, index) => (
              <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-semibold">
                  {index + 1}
                </div>
                {item.product && (
                  <>
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-600">{item.product.category}</p>
                    </div>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {item.quantity} vendidos
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Most Frequent Customers */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Clientes Frecuentes</h2>
          </div>
          <div className="space-y-3">
            {topCustomers.map((item, index) => (
              <div key={item.customerId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full font-semibold">
                  {index + 1}
                </div>
                {item.customer && (
                  <>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.customer.name}</p>
                      <p className="text-sm text-gray-600">{item.customer.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        {item.purchases} compras
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {item.customer.totalPurchases.toFixed(2)} Bs
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alert - PROMINENT */}
      {lowStock.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border-2 border-orange-300">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 animate-pulse" />
                <h2 className="text-lg font-bold text-orange-900">⚠️ ALERTA: Stock Bajo en {lowStock.length} Producto(s)</h2>
              </div>
              <p className="text-sm text-orange-800 mb-4">
                Los siguientes productos tienen stock igual o menor al mínimo requerido. ¡Realiza un pedido urgente!
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lowStock.map(product => (
                  <div key={product.id} className="bg-white rounded-lg p-3 border-l-4 border-orange-500 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex gap-3">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-14 h-14 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-600 mb-2">{product.category}</p>
                        <div className="flex gap-2 text-xs">
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold">
                            Stock: {product.stock}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            Min: {product.minStock}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
