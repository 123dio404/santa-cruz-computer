/**
 * Cart.tsx - Carrito de Compras del Cliente
 *
 * Página donde el cliente revisa y confirma su pedido online antes de pagar.
 * Los productos se guardan en localStorage con la clave 'storeCart'.
 *
 * FLUJO DE COMPRA:
 * 1. Cliente agrega productos desde Store.tsx → se guardan en localStorage
 * 2. Entra al carrito y ve su lista de productos
 * 3. Puede cambiar cantidades o eliminar ítems
 * 4. Hace clic en "Proceder al Pago" → modal de selección de método de pago
 * 5. Confirma → se crea la venta en el backend con pedido_online: true
 * 6. El pedido queda en estado 'pending' hasta que el admin lo confirme
 *
 * MÉTODOS DE PAGO:
 * - card → 'tarjeta' en el backend
 * - qr   → 'transferencia' en el backend
 */
import { useEffect, useState } from 'react';
import { Trash2, CreditCard, QrCode, ShoppingBag, X } from 'lucide-react';
import { ventasAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface StoreCartItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  stock: number;
  imagen_url?: string | null;
}

type PaymentMethod = 'card' | 'qr';

const metodoPagoMap: Record<PaymentMethod, string> = { card: 'tarjeta', qr: 'transferencia' };

export function Cart() {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<StoreCartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('storeCart');
    if (saved) {
      try { setCartItems(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Guarda el carrito en estado y localStorage al mismo tiempo
  const saveCart = (items: StoreCartItem[]) => {
    setCartItems(items);
    localStorage.setItem('storeCart', JSON.stringify(items));
  };

  // Actualiza la cantidad de un producto (mínimo 1)
  const updateQuantity = (productId: number, qty: number) => {
    if (qty < 1) return;
    saveCart(cartItems.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  // Elimina un producto del carrito
  const removeItem = (productId: number) => saveCart(cartItems.filter(i => i.productId !== productId));

  // Suma el total de todos los ítems (precio × cantidad)
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);

  // Envía el pedido al backend y limpia el carrito si fue exitoso
  const handleCheckout = async () => {
    if (!user) { alert('Debes iniciar sesión para realizar un pedido'); return; }
    setProcessingOrder(true);
    try {
      await ventasAPI.create({
        cliente: parseInt(user.id),
        usuario: null,
        pedido_online: true,
        detalles: cartItems.map(i => ({
          producto: i.productId,
          cantidad: i.quantity,
          precio_unitario: i.price,
        })),
        pagos: [{ monto: total, metodo: metodoPagoMap[paymentMethod] }],
      });
      setShowCheckoutModal(false);
      setShowSuccessModal(true);
      setTimeout(() => {
        saveCart([]);
        setShowSuccessModal(false);
      }, 2500);
    } catch (err) {
      alert(`Error al procesar pedido: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setProcessingOrder(false);
    }
  };

  const paymentMethods = [
    { value: 'card' as PaymentMethod, label: 'Tarjeta de Crédito/Débito', icon: CreditCard },
    { value: 'qr' as PaymentMethod, label: 'Código QR', icon: QrCode },
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
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map(item => (
              <div key={item.productId} className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imagen_url
                      ? <img
                          src={item.imagen_url.startsWith('http') ? item.imagen_url : `http://localhost:8000${item.imagen_url}`}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      : <ShoppingBag className="w-8 h-8 text-blue-300" />
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{item.productName}</h3>
                      <button onClick={() => removeItem(item.productId)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Cantidad:</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100">-</button>
                          <span className="w-10 text-center font-medium">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{item.price.toFixed(2)} Bs c/u</p>
                        <p className="text-xl font-bold text-gray-900">{(item.price * item.quantity).toFixed(2)} Bs</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 border border-gray-200 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen del Pedido</h2>
              <div className="space-y-3 mb-6">
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-gray-900">{total.toFixed(2)} Bs</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowCheckoutModal(true)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Proceder al Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Método de Pago</h2>
              <button onClick={() => setShowCheckoutModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-3 mb-6">
                {paymentMethods.map(method => {
                  const Icon = method.icon;
                  return (
                    <button key={method.value} onClick={() => setPaymentMethod(method.value)}
                      className={`w-full flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${paymentMethod === method.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <Icon className={`w-5 h-5 ${paymentMethod === method.value ? 'text-blue-600' : 'text-gray-600'}`} />
                      <span className={`font-medium ${paymentMethod === method.value ? 'text-blue-600' : 'text-gray-700'}`}>{method.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pt-4 border-t border-gray-200 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total a pagar:</span>
                  <span className="text-2xl font-bold text-gray-900">{total.toFixed(2)} Bs</span>
                </div>
              </div>
              <button onClick={handleCheckout} disabled={processingOrder}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50">
                {processingOrder ? 'Procesando...' : 'Confirmar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}

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
