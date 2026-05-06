import { useState, useEffect } from 'react';
import { Search, Filter, AlertTriangle, Package, Eye, X } from 'lucide-react';
import { productosAPI, ApiProduct } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts]           = useState<ApiProduct[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState('');
  const [estadoFilter, setEstadoFilter]   = useState('all');
  const [adjustingId, setAdjustingId]     = useState<number | null>(null);
  const [adjustValue, setAdjustValue]     = useState('');
  const [detailProduct, setDetailProduct] = useState<ApiProduct | null>(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setProducts(await productosAPI.getAll());
    } catch {
      alert('Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  const estados = ['all', ...Array.from(new Set(products.map(p => p.estado).filter(Boolean) as string[]))];

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.marca ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.modelo ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado = estadoFilter === 'all' || p.estado === estadoFilter;
    return matchSearch && matchEstado;
  });

  const totalItems  = filtered.reduce((s, p) => s + (p.stock ?? 0), 0);
  const totalValue  = filtered.reduce((s, p) => s + (parseFloat(String(p.precio_venta ?? p.price)) * (p.stock ?? 0)), 0);
  const lowStockProducts = products.filter(p => p.is_low_stock);

  const handleAdjustStock = async (id: number) => {
    const newStock = parseInt(adjustValue);
    if (isNaN(newStock) || newStock < 0) { alert('Stock inválido'); return; }
    try {
      const updated = await productosAPI.adjustStock(id, newStock);
      setProducts(products.map(p => p.id === id ? updated : p));
      setAdjustingId(null);
      setAdjustValue('');
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };

  const imgSrc = (url: string) =>
    url.startsWith('http') ? url : `http://localhost:8000${url}`;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-gray-600">Vista completa del inventario</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Productos</p>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Total Unidades</p>
          <p className="text-2xl font-bold text-gray-900">{totalItems}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Valor Inventario</p>
          <p className="text-2xl font-bold text-gray-900">{totalValue.toFixed(2)} Bs</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Buscar por nombre, marca, modelo..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white">
              {estados.map(e => (
                <option key={e} value={e}>{e === 'all' ? 'Todos los estados' : e}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerta stock bajo */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Alerta de Stock Bajo</h3>
              <p className="text-sm text-red-700 mt-1">
                {lowStockProducts.length} producto{lowStockProducts.length !== 1 ? 's' : ''} con stock ≤ stock mínimo
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {lowStockProducts.map(p => (
                  <span key={p.id} className="bg-white px-3 py-1 rounded text-sm border border-red-200 text-red-900">
                    {p.name} — {p.stock ?? 0} / mín {p.stock_minimo}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Producto</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Marca / Modelo</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">P. Compra</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">P. Venta</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Stock</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Stock Mín.</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Disponibilidad</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => (
                <tr key={product.id} className={`border-b border-gray-100 hover:bg-gray-50 ${product.is_low_stock ? 'bg-red-50' : ''}`}>
                  {/* Producto */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.imagen_url
                          ? <img src={imgSrc(product.imagen_url)} alt={product.name} className="w-full h-full object-cover" />
                          : <Package className="w-5 h-5 text-blue-400" />
                        }
                      </div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                    </div>
                  </td>

                  {/* Marca / Modelo */}
                  <td className="py-3 px-4 text-gray-600">
                    {[product.marca, product.modelo].filter(Boolean).join(' / ') || '—'}
                  </td>

                  {/* Precio compra */}
                  <td className="py-3 px-4 text-right text-gray-600">
                    {product.precio_compra
                      ? `${parseFloat(String(product.precio_compra)).toFixed(2)} Bs`
                      : <span className="text-gray-400">—</span>}
                  </td>

                  {/* Precio venta */}
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    {parseFloat(String(product.precio_venta ?? product.price)).toFixed(2)} Bs
                  </td>

                  {/* Stock */}
                  <td className="py-3 px-4 text-center">
                    <span className={`font-bold ${product.is_low_stock ? 'text-red-600' : 'text-gray-900'}`}>
                      {product.stock ?? 0}
                    </span>
                  </td>

                  {/* Stock mínimo */}
                  <td className="py-3 px-4 text-center text-gray-500">{product.stock_minimo}</td>

                  {/* Estado */}
                  <td className="py-3 px-4 text-gray-600 capitalize">{product.estado || '—'}</td>

                  {/* Disponibilidad */}
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.is_low_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {product.is_low_stock ? 'Stock Bajo' : 'Disponible'}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Ojo — visible para admin y vendedor */}
                      <button onClick={() => setDetailProduct(product)} title="Ver detalles"
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Ajustar stock — solo admin */}
                      {isAdmin && (
                        adjustingId === product.id ? (
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" value={adjustValue}
                              onChange={e => setAdjustValue(e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                              autoFocus />
                            <button onClick={() => handleAdjustStock(product.id)}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                              OK
                            </button>
                            <button onClick={() => { setAdjustingId(null); setAdjustValue(''); }}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAdjustingId(product.id); setAdjustValue(String(product.stock ?? 0)); }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded-lg">
                            Ajustar
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de detalles — solo lectura, admin y vendedor */}
      {detailProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setDetailProduct(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl"
            onClick={e => e.stopPropagation()}>

            {/* Imagen */}
            <div className="h-48 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center relative overflow-hidden">
              {detailProduct.imagen_url
                ? <img src={imgSrc(detailProduct.imagen_url)} alt={detailProduct.name} className="w-full h-full object-cover" />
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
                <span className="text-xl font-bold text-blue-600 whitespace-nowrap">
                  {parseFloat(String(detailProduct.precio_venta ?? detailProduct.price)).toFixed(2)} Bs
                </span>
              </div>

              {/* Ficha técnica */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-gray-700 mb-2">Ficha técnica</p>
                {([
                  ['Marca',      detailProduct.marca],
                  ['Modelo',     detailProduct.modelo],
                  ['Año',        detailProduct.anio],
                  ['Estado',     detailProduct.estado],
                  ['Categoría',  detailProduct.categoria_nombre],
                  ['Stock',      detailProduct.stock ?? 0],
                  ['Stock mín.', detailProduct.stock_minimo],
                  ['P. Compra',  detailProduct.precio_compra
                    ? `${parseFloat(String(detailProduct.precio_compra)).toFixed(2)} Bs`
                    : null],
                ] as [string, unknown][])
                  .filter(([, v]) => v !== null && v !== undefined && v !== '')
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-900 capitalize">{String(value)}</span>
                    </div>
                  ))}
              </div>

              {/* Descripción */}
              {detailProduct.descripcion ? (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Descripción</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{detailProduct.descripcion}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Sin descripción registrada.</p>
              )}

              <button onClick={() => setDetailProduct(null)}
                className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
