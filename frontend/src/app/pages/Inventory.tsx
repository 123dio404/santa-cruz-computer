import { useState } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react';
import { mockProducts, mockStockMovements } from '../data/mockData';

export function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showMovements, setShowMovements] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const categories = ['all', ...new Set(mockProducts.map(p => p.category))];

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalValue = filteredProducts.reduce((sum, p) => sum + (p.salePrice * p.stock), 0);
  const totalCost = filteredProducts.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);
  const totalItems = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
  const lowStockProducts = mockProducts.filter(p => p.stock <= p.minStock);

  const getProductMovements = (productId: string) => {
    return mockStockMovements.filter(m => m.productId === productId);
  };

  const handleViewMovements = (productId: string) => {
    setSelectedProductId(productId);
    setShowMovements(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-gray-600">Vista completa del inventario y movimientos</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Productos</p>
          <p className="text-2xl font-bold text-gray-900">{filteredProducts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Unidades</p>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Valor Inventario</p>
          <p className="text-2xl font-bold text-gray-900">{totalValue.toFixed(2)} Bs</p>
          <p className="text-xs text-gray-500 mt-1">Precio venta</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Costo Inventario</p>
          <p className="text-2xl font-bold text-gray-900">{totalCost.toFixed(2)} Bs</p>
          <p className="text-xs text-gray-500 mt-1">Precio costo</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'Todas las categorías' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">⚠️ Alerta de Stock Bajo</h3>
              <p className="text-sm text-red-700 mt-1">
                {lowStockProducts.length} producto{lowStockProducts.length !== 1 ? 's' : ''} con stock mínimo o bajo
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {lowStockProducts.map(product => (
                  <div key={product.id} className="bg-white rounded px-3 py-2 text-sm border border-red-200 hover:shadow-md transition-shadow">
                    <p className="font-medium text-red-900 line-clamp-1">{product.name}</p>
                    <p className="text-xs text-red-600 mt-1">📦 Stock: <span className="font-semibold">{product.stock}</span> / Mín: {product.minStock}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Producto</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Categoría</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Precio Costo</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Precio Venta</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Margen</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Stock</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Stock Mín</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const margin = ((product.salePrice - product.costPrice) / product.costPrice * 100).toFixed(1);
                return (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                        {product.category}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-600">
                      {product.costPrice.toFixed(2)} Bs
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900 font-medium">
                      {product.salePrice.toFixed(2)} Bs
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-green-600 font-medium">
                        +{margin}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right text-gray-900 font-medium">
                      {product.stock}
                    </td>
                    <td className="py-4 px-4 text-right text-gray-600">
                      {product.minStock}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        product.stock > product.minStock ? 'bg-green-100 text-green-700' :
                        product.stock === product.minStock ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {product.stock > product.minStock ? 'Disponible' :
                         product.stock === product.minStock ? 'Stock Mínimo' :
                         'Stock Bajo'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleViewMovements(product.id)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Ver Movimientos
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movements Modal */}
      {showMovements && selectedProductId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Historial de Movimientos</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {mockProducts.find(p => p.id === selectedProductId)?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowMovements(false);
                  setSelectedProductId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {getProductMovements(selectedProductId).map(movement => (
                  <div key={movement.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className={`p-2 rounded-lg ${
                      movement.type === 'increase' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {movement.type === 'increase' ? (
                        <TrendingUp className="w-5 h-5 text-green-600" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {movement.type === 'increase' ? 'Incremento' : 'Disminución'} de Stock
                          </p>
                          <p className="text-sm text-gray-600">{movement.reason}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          movement.type === 'increase'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {movement.type === 'increase' ? '+' : '-'}{movement.quantity} unidades
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>📅 {movement.date}</span>
                        <span>👤 {movement.user}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {getProductMovements(selectedProductId).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No hay movimientos registrados para este producto</p>
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
