import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard, Banknote, QrCode, ShoppingCart, FileText, Package } from 'lucide-react';
import { ventasAPI, productosAPI, usuariosAPI, categoriasAPI, ApiProduct, ApiUser, ApiCategoria } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SaleProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  categoria_id: number | null;
  imagen_url: string | null;
}

interface CartItem {
  product: SaleProduct;
  quantity: number;
}

type PaymentMethod = 'cash' | 'card' | 'qr';

const metodoPagoMap: Record<PaymentMethod, string> = {
  cash: 'efectivo',
  card: 'tarjeta',
  qr: 'transferencia',
};

const mapApiProduct = (p: ApiProduct): SaleProduct => ({
  id: String(p.id),
  name: p.name,
  description: `${p.marca ?? ''} ${p.modelo ?? ''}`.trim(),
  price: parseFloat(String(p.price)),
  stock: p.stock ?? 0,
  categoria_id: p.categoria ?? null,
  imagen_url: p.imagen_url ?? null,
});

export function Sales() {
  const { user } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customerNit, setCustomerNit] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showInvoice, setShowInvoice] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [backendProducts, setBackendProducts] = useState<SaleProduct[]>([]);
  const [clients, setClients] = useState<ApiUser[]>([]);
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);

  useEffect(() => {
    productosAPI.getAll()
      .then(data => setBackendProducts(data.map(mapApiProduct)))
      .catch(() => setBackendProducts([]));
    usuariosAPI.getByRole('cliente')
      .then(setClients)
      .catch(() => setClients([]));
    categoriasAPI.getAll()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  const filteredProducts = selectedCategoryId !== ''
    ? backendProducts.filter(p => p.categoria_id === selectedCategoryId)
    : backendProducts;

  const handleCustomerSelect = (clientId: string) => {
    setSelectedCustomerId(clientId);
    const client = clients.find(c => String(c.id) === clientId);
    if (client) setCustomerName(client.name);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const product = backendProducts.find(p => p.id === selectedProduct);
    if (!product) return;
    const existing = cart.find(item => item.product.id === selectedProduct);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === selectedProduct
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity }]);
    }
    setSelectedProduct('');
    setQuantity(1);
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(item => item.product.id !== productId));

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCart(cart.map(item =>
      item.product.id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleShowInvoice = () => {
    if (cart.length === 0 || !customerName || !customerNit) {
      alert('Por favor complete todos los campos');
      return;
    }
    setShowInvoice(true);
  };

  const handleCompleteSale = async () => {
    if (!user) {
      alert('Error: No se encontró información del vendedor. Por favor inicia sesión nuevamente.');
      return;
    }
    try {
      await ventasAPI.create({
        cliente: selectedCustomerId ? parseInt(selectedCustomerId) : null,
        vendedor: parseInt(user.id),
        total: subtotal,
        status: 'completed',
        detalles: cart.map(item => ({
          producto: parseInt(item.product.id),
          cantidad: item.quantity,
          precio_unitario: item.product.price,
        })),
        pagos: [{ monto: subtotal, metodo: metodoPagoMap[paymentMethod] }],
      });

      setShowInvoice(false);
      setShowSuccessModal(true);
      productosAPI.getAll()
        .then(data => setBackendProducts(data.map(mapApiProduct)))
        .catch(() => {});
      setTimeout(() => {
        setCart([]);
        setCustomerName('');
        setCustomerNit('');
        setSelectedCustomerId('');
        setPaymentMethod('cash');
        setSelectedCategory('');
        setShowSuccessModal(false);
      }, 2000);
    } catch (error) {
      console.error('Error al completar venta:', error);
      alert(`Error al registrar venta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: Banknote },
    { value: 'card', label: 'Tarjeta', icon: CreditCard },
    { value: 'qr', label: 'Código QR', icon: QrCode },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Venta</h1>
        <p className="text-gray-600">Registrar una nueva venta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos del Cliente</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map(client => (
                  <option key={client.id} value={String(client.id)}>
                    {client.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              <input
                type="text"
                value={customerNit}
                onChange={(e) => setCustomerNit(e.target.value)}
                placeholder="NIT/CI"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Product Selection */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agregar Productos</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. Seleccione la Categoría
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => {
                    setSelectedCategoryId(e.target.value ? parseInt(e.target.value) : '');
                    setSelectedProduct('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar categoría</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>

              {selectedCategoryId !== '' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      2. Seleccione el Producto
                    </label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => setSelectedProduct(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Seleccionar producto</option>
                      {filteredProducts.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {product.price.toFixed(2)} Bs (Stock: {product.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={addToCart}
                      disabled={!selectedProduct}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-[42px]"
                    >
                      <Plus className="w-5 h-5" />
                      Agregar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Carrito de Venta</h2>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No hay productos en el carrito</div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-16 h-16 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.product.imagen_url ? (
                        <img
                          src={item.product.imagen_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'; }}
                        />
                      ) : null}
                      <div
                        className="w-full h-full items-center justify-center"
                        style={{ display: item.product.imagen_url ? 'none' : 'flex' }}
                      >
                        <Package className="w-8 h-8 text-blue-200" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-600">{item.product.price.toFixed(2)} Bs c/u</p>
                      <p className="text-xs text-gray-500">{item.product.description || 'General'}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                      >-</button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                      >+</button>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <p className="font-semibold text-gray-900">
                        {(item.product.price * item.quantity).toFixed(2)} Bs
                      </p>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Venta</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Método de Pago</label>
                <div className="space-y-2">
                  {paymentMethods.map(method => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                        className={`w-full flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${
                          paymentMethod === method.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${paymentMethod === method.value ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className={`font-medium ${paymentMethod === method.value ? 'text-blue-600' : 'text-gray-700'}`}>
                          {method.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between mb-4">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{subtotal.toFixed(2)} Bs</span>
                </div>

                <button
                  onClick={handleShowInvoice}
                  disabled={cart.length === 0 || !customerName || !customerNit}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  Ver Factura
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="text-center mb-6 pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">FACTURA</h2>
                <p className="text-gray-600">SantaCruz-Computer</p>
                <p className="text-sm text-gray-500">Av. Arce 2147, La Paz</p>
                <p className="text-sm text-gray-500">NIT: 1234567890</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Cliente:</p>
                  <p className="font-medium text-gray-900">{customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">NIT/CI:</p>
                  <p className="font-medium text-gray-900">{customerNit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha:</p>
                  <p className="font-medium text-gray-900">{new Date().toLocaleDateString('es-BO')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Método de Pago:</p>
                  <p className="font-medium text-gray-900 capitalize">{paymentMethod}</p>
                </div>
              </div>

              <table className="w-full mb-6">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Producto</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Cant.</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Precio</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.product.id} className="border-b border-gray-100">
                      <td className="py-3 px-3 text-sm">{item.product.name}</td>
                      <td className="py-3 px-3 text-sm text-right">{item.quantity}</td>
                      <td className="py-3 px-3 text-sm text-right">{item.product.price.toFixed(2)} Bs</td>
                      <td className="py-3 px-3 text-sm text-right font-medium">
                        {(item.product.price * item.quantity).toFixed(2)} Bs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>TOTAL:</span>
                  <span>{subtotal.toFixed(2)} Bs</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInvoice(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCompleteSale}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Completar Venta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">¡Venta Completada!</h3>
            <p className="text-gray-600">La venta se ha registrado exitosamente</p>
          </div>
        </div>
      )}
    </div>
  );
}
