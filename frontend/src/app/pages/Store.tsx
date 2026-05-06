import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Filter, X, Plus, Minus, Package, Eye } from 'lucide-react';
import { productosAPI, ApiProduct } from '../services/api';

interface StoreCartItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  stock: number;
  imagen_url?: string | null;
}

export function Store() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cartItems, setCartItems] = useState<StoreCartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null);

  useEffect(() => {
    productosAPI.getAll()
      .then(setProducts)
      .catch(() => alert('Error al cargar productos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('storeCart');
    if (saved) {
      try { setCartItems(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const saveCart = (items: StoreCartItem[]) => {
    setCartItems(items);
    localStorage.setItem('storeCart', JSON.stringify(items));
  };

  const categories = ['all', ...Array.from(new Set(
    products.map(p => p.marca || p.estado || 'General').filter(Boolean)
  ))];

  const filtered = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(term) ||
      (p.marca ?? '').toLowerCase().includes(term) ||
      (p.modelo ?? '').toLowerCase().includes(term);
    const cat = p.marca || p.estado || 'General';
    const matchCat = categoryFilter === 'all' || cat === categoryFilter;
    return matchSearch && matchCat;
  });

  const addToCart = (product: ApiProduct) => {
    const price = parseFloat(String(product.price));
    const existing = cartItems.find(i => i.productId === product.id);
    if (existing) {
      saveCart(cartItems.map(i =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      saveCart([...cartItems, { productId: product.id, productName: product.name, price, quantity: 1, stock: product.stock ?? 0, imagen_url: product.imagen_url }]);
    }
  };

  const updateQty = (productId: number, qty: number) => {
    if (qty < 1) { saveCart(cartItems.filter(i => i.productId !== productId)); return; }
    saveCart(cartItems.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const removeFromCart = (productId: number) => saveCart(cartItems.filter(i => i.productId !== productId));
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tienda</h1>
          <p className="text-gray-600">Explora nuestro catálogo de productos</p>
        </div>
        <button onClick={() => setShowCart(!showCart)}
          className="relative flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <ShoppingCart className="w-5 h-5" />
          <span className="font-medium">{totalItems}</span>
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {showCart && (
        <div className="bg-white rounded-xl p-6 border-2 border-blue-500 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Carrito</h2>
            <button onClick={() => setShowCart(false)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          {cartItems.length === 0 ? (
            <p className="text-center py-4 text-gray-500">Tu carrito está vacío</p>
          ) : (
            <>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {cartItems.map(item => (
                  <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{item.productName}</p>
                      <p className="text-xs text-gray-600">{item.price.toFixed(2)} Bs × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="p-1 hover:bg-gray-200 rounded"><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="p-1 hover:bg-gray-200 rounded"><Plus className="w-3 h-3" /></button>
                      <button onClick={() => removeFromCart(item.productId)} className="p-1 text-red-500 hover:bg-red-50 rounded"><X className="w-3 h-3" /></button>
                    </div>
                    <span className="text-sm font-bold text-blue-600 min-w-[60px] text-right">
                      {(item.price * item.quantity).toFixed(2)} Bs
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-semibold text-gray-700">Total:</span>
                <span className="text-xl font-bold text-blue-600">{cartTotal.toFixed(2)} Bs</span>
              </div>
              <a href="/cart"
                className="block w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-center font-semibold">
                Ir al Carrito
              </a>
            </>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar productos..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white">
              {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'Todas las categorías' : c}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(product => {
          const price = parseFloat(String(product.precio_venta ?? product.price));
          const stock = product.stock ?? 0;
          return (
            <div key={product.id} className="bg-white rounded-xl overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="h-40 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative overflow-hidden">
                {product.imagen_url
                  ? <img
                      src={product.imagen_url.startsWith('http') ? product.imagen_url : `http://localhost:8000${product.imagen_url}`}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  : <Package className="w-16 h-16 text-blue-200" />
                }
                {stock < 10 && stock > 0 && (
                  <span className="absolute top-2 right-2 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded">
                    Pocas unidades
                  </span>
                )}
                {stock === 0 && (
                  <span className="absolute top-2 right-2 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded">
                    Agotado
                  </span>
                )}
              </div>
              <div className="p-4">
                <span className="text-xs text-gray-500 uppercase">{product.marca || product.estado || 'General'}</span>
                <h3 className="font-semibold text-gray-900 mt-1 mb-1">{product.name}</h3>
                {product.modelo && <p className="text-sm text-gray-500 mb-2">{product.modelo}</p>}
                <div className="mt-3 space-y-2">
                  <span className="block text-xl font-bold text-gray-900">{price.toFixed(2)} Bs</span>
                  <button onClick={() => setDetailProduct(product)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">
                    <Eye className="w-4 h-4" /> Ver detalles
                  </button>
                  {stock > 0 ? (
                    <button onClick={() => addToCart(product)}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold">
                      <ShoppingCart className="w-4 h-4" /> Agregar al carrito
                    </button>
                  ) : (
                    <span className="block w-full text-center px-3 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">Agotado</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Modal de detalle de producto */}
      {detailProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setDetailProduct(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl"
            onClick={e => e.stopPropagation()}>
            {/* Imagen */}
            <div className="h-52 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative overflow-hidden">
              {detailProduct.imagen_url
                ? <img
                    src={detailProduct.imagen_url.startsWith('http') ? detailProduct.imagen_url : `http://localhost:8000${detailProduct.imagen_url}`}
                    alt={detailProduct.name}
                    className="w-full h-full object-cover"
                  />
                : <Package className="w-20 h-20 text-blue-200" />
              }
              <button onClick={() => setDetailProduct(null)}
                className="absolute top-3 right-3 p-1.5 bg-white bg-opacity-80 rounded-full hover:bg-opacity-100 transition">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Nombre y precio */}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-900 leading-tight">{detailProduct.name}</h2>
                <span className="text-2xl font-bold text-blue-600 whitespace-nowrap">
                  {parseFloat(String(detailProduct.precio_venta ?? detailProduct.price)).toFixed(2)} Bs
                </span>
              </div>

              {/* Ficha técnica */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700 mb-1">Ficha técnica</p>
                {detailProduct.marca && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Marca</span>
                    <span className="font-medium text-gray-900">{detailProduct.marca}</span>
                  </div>
                )}
                {detailProduct.modelo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Modelo</span>
                    <span className="font-medium text-gray-900">{detailProduct.modelo}</span>
                  </div>
                )}
                {detailProduct.anio && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Año</span>
                    <span className="font-medium text-gray-900">{detailProduct.anio}</span>
                  </div>
                )}
                {detailProduct.estado && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estado</span>
                    <span className="font-medium text-gray-900 capitalize">{detailProduct.estado}</span>
                  </div>
                )}
              </div>

              {/* Descripción */}
              {detailProduct.descripcion && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Descripción</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{detailProduct.descripcion}</p>
                </div>
              )}

              {/* Botón agregar */}
              <div className="pt-1">
                {(detailProduct.stock ?? 0) > 0 ? (
                  <button onClick={() => { addToCart(detailProduct); setDetailProduct(null); }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold">
                    <ShoppingCart className="w-5 h-5" /> Agregar al carrito
                  </button>
                ) : (
                  <span className="block w-full text-center py-3 bg-gray-100 text-gray-500 rounded-xl text-sm">Sin stock disponible</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
