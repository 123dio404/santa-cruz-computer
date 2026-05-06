import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, X, Upload, Package, AlertTriangle, Search, Filter } from 'lucide-react';
import { productosAPI, categoriasAPI, ApiProduct, ApiCategoria } from '../services/api';
import { useAuth } from '../context/AuthContext';

type FormData = {
  name: string;
  marca: string;
  modelo: string;
  anio: string;
  price: string;
  precio_compra: string;
  precio_venta: string;
  stock: string;
  stock_minimo: string;
  estado: string;
  categoria: string;
  descripcion: string;
};

const emptyForm: FormData = {
  name: '', marca: '', modelo: '', anio: '',
  price: '', precio_compra: '', precio_venta: '',
  stock: '', stock_minimo: '0', estado: '', categoria: '',
  descripcion: '',
};

export function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts]             = useState<ApiProduct[]>([]);
  const [categorias, setCategorias]         = useState<ApiCategoria[]>([]);
  const [loading, setLoading]               = useState(true);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [formData, setFormData]             = useState<FormData>(emptyForm);
  const [imageFile, setImageFile]           = useState<File | null>(null);
  const [imagePreview, setImagePreview]     = useState<string | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [searchTerm, setSearchTerm]         = useState('');
  const [estadoFilter, setEstadoFilter]     = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([loadProducts(), loadCategorias()]);
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setProducts(await productosAPI.getAll());
    } catch {
      alert('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const loadCategorias = async () => {
    try { setCategorias(await categoriasAPI.getAll()); }
    catch { setCategorias([]); }
  };

  const handleOpenModal = (product?: ApiProduct) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name:          product.name,
        marca:         product.marca          ?? '',
        modelo:        product.modelo         ?? '',
        anio:          product.anio           ? String(product.anio)           : '',
        price:         String(product.price),
        precio_compra: product.precio_compra  ? String(product.precio_compra)  : '',
        precio_venta:  product.precio_venta   ? String(product.precio_venta)   : '',
        stock:         String(product.stock   ?? 0),
        stock_minimo:  String(product.stock_minimo ?? 0),
        estado:        product.estado         ?? '',
        categoria:     product.categoria      ? String(product.categoria)      : '',
        descripcion:   product.descripcion    ?? '',
      });
      setImagePreview(product.imagen_url ?? null);
    } else {
      setEditingProduct(null);
      setFormData(emptyForm);
      setImagePreview(null);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(emptyForm);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // precio_venta es el precio principal; price se mantiene sincronizado
      const precioVenta = formData.precio_venta ? parseFloat(formData.precio_venta) : null;
      const payload: Record<string, any> = {
        name:          formData.name,
        marca:         formData.marca         || null,
        modelo:        formData.modelo        || null,
        anio:          formData.anio          ? parseInt(formData.anio)           : null,
        price:         precioVenta ?? (formData.price ? parseFloat(formData.price) : 0),
        precio_compra: formData.precio_compra ? parseFloat(formData.precio_compra) : null,
        precio_venta:  precioVenta,
        stock:         parseInt(formData.stock),
        stock_minimo:  parseInt(formData.stock_minimo) || 0,
        estado:        formData.estado        || null,
        categoria:     formData.categoria     ? parseInt(formData.categoria)      : null,
        descripcion:   formData.descripcion   || null,
      };

      if (editingProduct) {
        const updated = await productosAPI.update(editingProduct.id, payload, imageFile);
        setProducts(products.map(p => p.id === editingProduct.id ? updated : p));
      } else {
        const created = await productosAPI.create(payload, imageFile);
        setProducts([created, ...products]);
      }
      handleCloseModal();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      await productosAPI.delete(id);
      setProducts(products.filter(p => p.id !== id));
    } catch {
      alert('Error al eliminar el producto');
    }
  };

  const textField = (key: keyof FormData, label: string, type = 'text', required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        value={formData[key]}
        onChange={e => setFormData({ ...formData, [key]: e.target.value })}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        required={required}
      />
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  // ── Lógica de filtro idéntica a Inventory ──
  const estados = ['all', ...Array.from(new Set(products.map(p => p.estado).filter(Boolean) as string[]))];

  const filtered = products.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.marca  ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.modelo ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado = estadoFilter === 'all' || p.estado === estadoFilter;
    return matchSearch && matchEstado;
  });

  const lowStockProducts = products.filter(p => p.is_low_stock);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600">Gestión de productos del inventario</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Producto
          </button>
        )}
      </div>

      {/* Filtros — idénticos a Inventory */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, marca, modelo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={estadoFilter}
              onChange={e => setEstadoFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            >
              {estados.map(e => (
                <option key={e} value={e}>{e === 'all' ? 'Todos los estados' : e}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Alerta de stock bajo — idéntica a Inventory */}
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
                    {p.name} — Stock: {p.stock ?? 0} / Mín: {p.stock_minimo}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
          No hay productos registrados.
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center text-gray-500">
          No se encontraron productos con ese filtro.
        </div>
      ) : (
        /* Vista de tabla */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Producto</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Categoría</th>
                  <th className="text-left py-3 px-4 text-gray-600 font-medium">Estado</th>
                  <th className="text-right py-3 px-4 text-gray-600 font-medium">Precio</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-medium">Stock</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-medium">Stock Mínimo</th>
                  <th className="text-center py-3 px-4 text-gray-600 font-medium">Estado Stock</th>
                  {isAdmin && <th className="text-right py-3 px-4 text-gray-600 font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(product => {
                  const stock    = product.stock ?? 0;
                  const minStock = product.stock_minimo ?? 0;
                  const isBajo   = product.is_low_stock;

                  return (
                    <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${isBajo ? 'bg-red-50' : ''}`}>
                      {/* Producto */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-blue-50 flex items-center justify-center">
                            {product.imagen_url
                              ? <img
                                  src={
                                    product.imagen_url.startsWith('http')
                                      ? product.imagen_url
                                      : `http://localhost:8000${product.imagen_url}`
                                  }
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              : <Package className="w-5 h-5 text-blue-200" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            {(product.marca || product.modelo) && (
                              <p className="text-xs text-gray-500">
                                {[product.marca, product.modelo].filter(Boolean).join(' – ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="py-3 px-4 text-gray-600">
                        {product.categoria_nombre ?? <span className="text-gray-400">—</span>}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4">
                        {product.estado
                          ? <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs capitalize">{product.estado}</span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>

                      {/* Precio */}
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {parseFloat(String(product.price)).toFixed(2)} Bs
                      </td>

                      {/* Stock actual */}
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold text-base ${isBajo ? 'text-red-600' : 'text-gray-900'}`}>
                          {stock}
                        </span>
                      </td>

                      {/* Stock mínimo */}
                      <td className="py-3 px-4 text-center text-gray-600">
                        {minStock}
                      </td>

                      {/* Badge estado stock */}
                      <td className="py-3 px-4 text-center">
                        {isBajo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            Stock Bajo
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Acciones — solo admin */}
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs"
                            >
                              <Edit className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="flex items-center justify-center px-2 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de edición — solo admin */}
      {isAdmin && isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Imagen */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Imagen del producto</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="h-32 object-contain mx-auto rounded" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Upload className="w-8 h-8" />
                      <span className="text-sm">Haz clic para subir una imagen</span>
                      <span className="text-xs">JPG, PNG, WEBP (máx. 5 MB)</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                {imagePreview && (
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="mt-1 text-xs text-red-500 hover:text-red-700">
                    Quitar imagen
                  </button>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Describe las características principales del producto..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Nombre */}
              {textField('name', 'Nombre del producto *', 'text', true)}

              {/* Marca / Modelo */}
              <div className="grid grid-cols-2 gap-4">
                {textField('marca', 'Marca')}
                {textField('modelo', 'Modelo')}
              </div>

              {/* Año / Estado */}
              <div className="grid grid-cols-2 gap-4">
                {textField('anio', 'Año', 'number')}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Sin especificar</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="reacondicionado">Reacondicionado</option>
                  </select>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Sin categoría</option>
                  {categorias.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Fila A: Precio compra | Precio venta */}
              <div className="grid grid-cols-2 gap-4">
                {textField('precio_compra', 'Precio compra (Bs)', 'number')}
                {textField('precio_venta', 'Precio venta (Bs) *', 'number', true)}
              </div>

              {/* Fila B: Stock actual | Stock mínimo */}
              <div className="grid grid-cols-2 gap-4">
                {textField('stock', 'Stock actual *', 'number', true)}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock mínimo
                    <span className="ml-1 text-xs text-gray-400 font-normal">(alerta)</span>
                  </label>
                  <input type="number" min="0" value={formData.stock_minimo}
                    onChange={e => setFormData({ ...formData, stock_minimo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
