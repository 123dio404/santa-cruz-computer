/**
 * PaymentSuccess.tsx - Retorno del pago con Stripe
 *
 * A esta página llega el cliente DESPUÉS de pagar en Stripe (success_url).
 * La URL trae ?session_id=cs_...
 *
 * FLUJO:
 * 1. Lee el session_id de la URL.
 * 2. Llama a stripeAPI.confirm(session_id) → el backend verifica que el pago
 *    esté confirmado y RECIÉN crea la venta (estado 'pending').
 * 3. Limpia el carrito (localStorage 'storeCart').
 * 4. Muestra confirmación y enlace a "Mis Pedidos".
 *
 * El pedido queda 'pending' porque el cliente debe ir a la tienda a RECOGER el
 * producto; un vendedor/admin dará "Confirmar Entrega" cuando lo recoja.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { CheckCircle, XCircle, Loader2, ShoppingBag } from 'lucide-react';
import { stripeAPI, ApiVenta } from '../services/api';

type Estado = 'procesando' | 'exito' | 'error';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('procesando');
  const [mensaje, setMensaje] = useState('Confirmando tu pago...');
  const [ventaId, setVentaId] = useState<number | null>(null);
  const [venta, setVenta] = useState<ApiVenta | null>(null);
  // Evita doble confirmación si el efecto se ejecuta dos veces (React StrictMode)
  const yaConfirmado = useRef(false);

  useEffect(() => {
    if (yaConfirmado.current) return;
    yaConfirmado.current = true;

    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      setEstado('error');
      setMensaje('No se encontró la información del pago.');
      return;
    }

    stripeAPI.confirm(sessionId)
      .then(venta => {
        setVenta(venta);
        setVentaId(venta.id);
        setEstado('exito');
        setMensaje('¡Pago confirmado! Tu pedido fue registrado.');
        // Vaciar el carrito ya que la compra se completó
        localStorage.removeItem('storeCart');
      })
      .catch(err => {
        setEstado('error');
        setMensaje(err instanceof Error ? err.message : 'No se pudo confirmar el pago.');
      });
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full border border-gray-200 text-center">
        {estado === 'procesando' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Procesando pago</h2>
            <p className="text-gray-600">{mensaje}</p>
          </>
        )}

        {estado === 'exito' && (
          <>
            {/* Encabezado con logo (recibo de pago) */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/logo.png" alt="" className="h-10 w-auto"
                   onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
              <div className="text-left leading-tight">
                <p className="font-bold text-blue-800">SANTA CRUZ COMPUTER</p>
                <p className="text-xs text-gray-500">Recibo de Pago</p>
              </div>
            </div>

            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">¡Pago Confirmado!</h2>
            {ventaId && (
              <p className="text-sm text-gray-500 mb-3">Pedido #{ventaId} · 💳 Tarjeta (Stripe)</p>
            )}

            {/* Detalle de productos pagados */}
            {venta?.detalles && venta.detalles.length > 0 && (
              <div className="text-left border border-gray-200 rounded-lg overflow-hidden mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="text-left px-3 py-2 font-medium">Producto</th>
                      <th className="px-2 py-2 font-medium text-center">Cant.</th>
                      <th className="px-3 py-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venta.detalles.map(d => (
                      <tr key={d.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-800">{d.producto_name}</td>
                        <td className="px-2 py-2 text-center text-gray-600">{d.cantidad}</td>
                        <td className="px-3 py-2 text-right text-gray-800">Bs {Number(d.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-t border-gray-200">
                  <span className="font-semibold text-gray-700">TOTAL PAGADO</span>
                  <span className="font-bold text-blue-800">Bs {Number(venta.total).toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-2 text-left">
              ⏳ Tu pedido quedó <strong>pendiente de entrega</strong>. Pasa por la tienda a recoger tu
              producto; un vendedor confirmará la entrega y recibirás tu factura.
            </div>
            <p className="text-xs text-gray-400 mb-5">📧 Te enviamos este recibo a tu correo.</p>

            <div className="flex flex-col gap-2">
              <button onClick={() => navigate('/orders')}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                Ver Mis Pedidos
              </button>
              <button onClick={() => navigate('/store')}
                className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Seguir Comprando
              </button>
            </div>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-9 h-9 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No se pudo confirmar el pago</h2>
            <p className="text-gray-600 mb-6">{mensaje}</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate('/cart')}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2">
                <ShoppingBag className="w-5 h-5" /> Volver al Carrito
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
