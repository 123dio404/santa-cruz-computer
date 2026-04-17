import { useState } from 'react';
import { ShoppingCart, Search, Filter } from 'lucide-react';
import { mockProducts } from '../data/mockData';

export function Store() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cartCount, setCartCount] = useState(0);

  const categories = ['all', ...new Set(mockProducts.map(p => p.category))];

  const filteredProducts = mockProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const addToCart = () => {
    setCartCount(cartCount + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tienda</h1>
          <p className="text-gray-600">Explora nuestro catálogo de productos</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
          <ShoppingCart className="w-5 h-5" />
          <span className="font-medium">{cartCount}</span>
        </div>
      </div>

      {/* Search and Filter */}
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

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
            <div className="relative">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-48 object-cover"
              />
              {product.stock < 10 && (
                <span className="absolute top-2 right-2 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded">
                  Pocas unidades
                </span>
              )}
            </div>

            <div className="p-4">
              <span className="text-xs text-gray-500 uppercase">{product.category}</span>
              <h3 className="font-semibold text-gray-900 mt-1 mb-2">{product.name}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{product.description}</p>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-900">{product.salePrice} Bs</span>
                {product.stock > 0 ? (
                  <button
                    onClick={addToCart}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Agregar
                  </button>
                ) : (
                  <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">
                    Agotado
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
