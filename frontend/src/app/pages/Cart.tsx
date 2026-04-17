import { useState } from 'react';
import { Trash2, CreditCard, Banknote, QrCode, ShoppingBag, X } from 'lucide-react';
import { mockProducts, Product } from '../data/mockData';

interface CartItem {
  product: Product;
  quantity: number;
}

type PaymentMethod = 'cash' | 'card' | 'qr';

export function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([
    { product: mockProducts[0], quantity: 1 },
    { product: mockProducts[2], quantity: 2 }
  ]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCartItems(cartItems.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const removeItem = (productId: string) => {
    setCartItems(cartItems.filter(item => item.product.id !== productId));
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product.salePrice * item.quantity), 0);
  const shipping = 10;
  const total = subtotal + shipping;

  const handleCheckout = () => {
    setShowCheckoutModal(false);
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
      setCartItems([]);
    }, 2000);
  };

  const paymentMethods = [
    { value: 'card', label: 'Tarjeta de Crédito/Débito', icon: CreditCard },
    { value: 'qr', label: 'Código QR', icon: QrCode },
    { value: 'cash', label: 'Efectivo (Contra entrega)', icon: Banknote }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Carrito de Compras</h1>
        <p className="text-gray-600">Revisa tu pedido antes de finalizar</p>
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Tu carrito está vacío</h3>
          <p className="text-gray-600">Agrega productos desde la tienda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map(item => (
              <div key={item.product.id} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex gap-4">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.product.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{item.product.description}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Cantidad:</span>
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
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-600">{item.product.salePrice} Bs c/u</p>
                        <p className="text-xl font-bold text-gray-900">
                          {(item.product.salePrice * item.quantity).toFixed(2)} Bs
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-gray-200 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen del Pedido</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{subtotal.toFixed(2)} Bs</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Envío</span>
                  <span>{shipping.toFixed(2)} Bs</span>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-gray-900">{total.toFixed(2)} Bs</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowCheckoutModal(true)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Proceder al Pago
              </button>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Aceptamos:</p>
                <div className="flex gap-2">
                  <div className="px-3 py-2 bg-gray-100 rounded text-xs">Visa</div>
                  <div className="px-3 py-2 bg-gray-100 rounded text-xs">Mastercard</div>
                  <div className="px-3 py-2 bg-gray-100 rounded text-xs">QR</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Método de Pago</h2>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-3 mb-6">
                {paymentMethods.map(method => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                      className={`w-full flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
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

              <div className="pt-4 border-t border-gray-200 mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Total a pagar:</span>
                  <span className="text-2xl font-bold text-gray-900">{total.toFixed(2)} Bs</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Confirmar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">¡Pedido Confirmado!</h3>
            <p className="text-gray-600">Tu pedido ha sido procesado exitosamente</p>
          </div>
        </div>
      )}
    </div>
  );
}
