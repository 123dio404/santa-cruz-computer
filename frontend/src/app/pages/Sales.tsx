import { useState } from 'react';
import { Plus, Trash2, CreditCard, Banknote, QrCode, ShoppingCart, FileText, Gift } from 'lucide-react';
import { mockProducts, mockCustomers, Product, Customer } from '../data/mockData';

interface CartItem {
  product: Product;
  quantity: number;
}

type PaymentMethod = 'cash' | 'card' | 'qr';

export function Sales() {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customerNit, setCustomerNit] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showInvoice, setShowInvoice] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [redeemingReward, setRedeemingReward] = useState(false);

  const categories = [...new Set(mockProducts.map(p => p.category))];
  const filteredProducts = selectedCategory
    ? mockProducts.filter(p => p.category === selectedCategory)
    : [];

  const selectedCustomer = mockCustomers.find(c => c.id === selectedCustomerId);

  const addToCart = () => {
    if (!selectedProduct) return;

    const product = mockProducts.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingItem = cart.find(item => item.product.id === selectedProduct);

    if (existingItem) {
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

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);

  // Calculate loyalty discount (10% on peripherals, max 1000 Bs)
  const calculateLoyaltyDiscount = () => {
    if (!selectedCustomer || selectedCustomer.totalPurchases < 2500) return 0;

    const peripheralsTotal = cart
      .filter(item => item.product.category === 'Periféricos')
      .reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);

    const discount = peripheralsTotal * 0.1;
    return Math.min(discount, 1000);
  };

  const applyLoyaltyDiscount = () => {
    const discount = calculateLoyaltyDiscount();
    setLoyaltyDiscount(discount);
  };

  const total = subtotal - loyaltyDiscount;

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = mockCustomers.find(c => c.id === customerId);
    if (customer) {
      setCustomerName(customer.name);
      setCustomerNit(customer.nit);
    }
  };

  const handleShowInvoice = () => {
    if (cart.length === 0 || !customerName || !customerNit) {
      alert('Por favor complete todos los campos');
      return;
    }
    setShowInvoice(true);
  };

  const handleCompleteSale = () => {
    setShowInvoice(false);
    setShowSuccessModal(true);
    setTimeout(() => {
      setCart([]);
      setCustomerName('');
      setCustomerNit('');
      setSelectedCustomerId('');
      setLoyaltyDiscount(0);
      setRedeemingReward(false);
      setPaymentMethod('cash');
      setSelectedCategory('');
      setShowSuccessModal(false);
    }, 2000);
  };

  const paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: Banknote },
    { value: 'card', label: 'Tarjeta', icon: CreditCard },
    { value: 'qr', label: 'Código QR', icon: QrCode }
  ];

  const rewardOptions = [
    { id: '3', name: 'Teclado Mecánico' },
    { id: '4', name: 'Mouse Razer' },
    { id: '9', name: 'Audífonos HyperX' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Venta</h1>
        <p className="text-gray-600">Registrar una nueva venta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
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
                {mockCustomers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.nit}
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

            {selectedCustomer && selectedCustomer.totalPurchases >= 2500 && (
              <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-orange-600" />
                  <p className="text-sm font-medium text-orange-900">
                    Cliente elegible para beneficios de lealtad
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Category and Product Selection */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Agregar Productos</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. Seleccione la Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedProduct('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {selectedCategory && (
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
                          {product.name} - {product.salePrice} Bs (Stock: {product.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cantidad
                    </label>
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
              <div className="text-center py-8 text-gray-500">
                No hay productos en el carrito
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />

                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-600">{item.product.salePrice} Bs c/u</p>
                      <p className="text-xs text-gray-500">{item.product.category}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <p className="font-semibold text-gray-900">
                        {(item.product.salePrice * item.quantity).toFixed(2)} Bs
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
              {/* Loyalty Benefits */}
              {selectedCustomer && selectedCustomer.totalPurchases >= 2500 && cart.length > 0 && (
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Beneficios de Lealtad</h3>

                  {calculateLoyaltyDiscount() > 0 && (
                    <button
                      onClick={applyLoyaltyDiscount}
                      disabled={loyaltyDiscount > 0}
                      className="w-full mb-2 p-3 border-2 border-orange-300 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium text-orange-900">
                            10% Desc. Periféricos
                          </p>
                          <p className="text-xs text-orange-700">
                            Ahorra {calculateLoyaltyDiscount().toFixed(2)} Bs
                          </p>
                        </div>
                      </div>
                    </button>
                  )}

                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    <p>O puede canjear por:</p>
                    <ul className="mt-1 space-y-1">
                      {rewardOptions.map(reward => (
                        <li key={reward.id}>• {reward.name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Método de Pago
                </label>
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
                        <Icon className={`w-5 h-5 ${
                          paymentMethod === method.value ? 'text-blue-600' : 'text-gray-600'
                        }`} />
                        <span className={`font-medium ${
                          paymentMethod === method.value ? 'text-blue-600' : 'text-gray-700'
                        }`}>
                          {method.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{subtotal.toFixed(2)} Bs</span>
                  </div>
                  {loyaltyDiscount > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Descuento lealtad</span>
                      <span>-{loyaltyDiscount.toFixed(2)} Bs</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between mb-4">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{total.toFixed(2)} Bs</span>
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
              {/* Invoice Header */}
              <div className="text-center mb-6 pb-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">FACTURA</h2>
                <p className="text-gray-600">SantaCruz-Computer</p>
                <p className="text-sm text-gray-500">Av. Arce 2147, La Paz</p>
                <p className="text-sm text-gray-500">NIT: 1234567890</p>
              </div>

              {/* Customer Info */}
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

              {/* Products Table */}
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
                      <td className="py-3 px-3 text-sm text-right">{item.product.salePrice.toFixed(2)} Bs</td>
                      <td className="py-3 px-3 text-sm text-right font-medium">
                        {(item.product.salePrice * item.quantity).toFixed(2)} Bs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>{subtotal.toFixed(2)} Bs</span>
                </div>
                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Descuento lealtad:</span>
                    <span>-{loyaltyDiscount.toFixed(2)} Bs</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>TOTAL:</span>
                  <span>{total.toFixed(2)} Bs</span>
                </div>
              </div>

              {/* Actions */}
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
