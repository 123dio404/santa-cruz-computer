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
import { stripeAPI } from '../services/api';

type Estado = 'procesando' | 'exito' | 'error';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [estado, setEstado] = useState<Estado>('procesando');
  const [mensaje, setMensaje] = useState('Confirmando tu pago...');
  const [ventaId, setVentaId] = useState<number | null>(null);
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
      <div className="bg-white rounded-xl p-8 max-w-md w-full border border-gray-200 text-center">
        {estado === 'procesando' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Procesando pago</h2>
            <p className="text-gray-600">{mensaje}</p>
          </>
        )}

        {estado === 'exito' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Pago Confirmado!</h2>
            <p className="text-gray-600 mb-1">{mensaje}</p>
            {ventaId && <p className="text-sm text-gray-500 mb-4">Pedido #{ventaId}</p>}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 mb-6">
              Tu pedido quedó <strong>pendiente de entrega</strong>. Pasa por la tienda a
              recoger tu producto; un vendedor confirmará la entrega.
            </div>
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
