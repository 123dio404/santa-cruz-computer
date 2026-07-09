/**
 * Sales.tsx - Registro de Ventas (Admin y Vendedor)
 *
 * Página para que el personal registre ventas presenciales en la tienda.
 * A diferencia del carrito online (Cart.tsx), esta venta la hace el empleado
 * en nombre del cliente, dentro del sistema.
 *
 * FLUJO DE VENTA:
 * 1. Seleccionar categoría (opcional) para filtrar productos
 * 2. Elegir producto y cantidad → agregar al carrito interno
 * 3. Buscar/seleccionar cliente (o escribir su nombre manualmente)
 * 4. Seleccionar método de pago (efectivo, tarjeta, QR)
 * 5. Confirmar venta → se crea en el backend con status 'pending' o 'completed'
 *    según si el pago cubre el total
 * 6. Se muestra modal de éxito y opción de imprimir factura PDF
 *
 * MÉTODOS DE PAGO:
 * - cash → 'efectivo'
 * - card → 'tarjeta'
 * - qr   → 'transferencia'
 */
import { useState, useEffect } from 'react';
import {
  Plus, Trash2, CreditCard, Banknote, QrCode, ShoppingCart, FileText, Package, Crown,
  Wallet, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import {
  ventasAPI, productosAPI, clientesAPI, categoriasAPI, creditoAPI,
  ApiProduct, ApiCliente, ApiCategoria,
  ApiBloqueoCredito, ApiSimulacionCredito, CreditoAtomicoPayload,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

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

type PaymentMethod = 'cash' | 'card' | 'qr' | 'credito';

const metodoPagoMap: Record<Exclude<PaymentMethod, 'credito'>, string> = {
  cash: 'efectivo',
  card: 'tarjeta',
  qr: 'transferencia',
};

// Estado inicial del checklist del crédito (todo en false)
const checklistVacio = () => ({
  ci_solicitante: false, ci_conyuge: false, factura_servicios: false,
  boletas_pago: false, extracto_gestora: false,
  facturas_ultimo_ano: false, estados_financieros: false, nit: false,
  croquis_domicilio: false, croquis_negocio: false, respaldos_patrimoniales: false,
});
type ChecklistBool = ReturnType<typeof checklistVacio>;

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
  const [aplicarDescuento, setAplicarDescuento] = useState(true);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [backendProducts, setBackendProducts] = useState<SaleProduct[]>([]);
  const [clients, setClients] = useState<ApiCliente[]>([]);
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);

  // Estado Al Crédito
  const [bloqueoCredito,   setBloqueoCredito]   = useState<ApiBloqueoCredito | null>(null);
  const [simulacion,       setSimulacion]       = useState<ApiSimulacionCredito | null>(null);
  const [showChecklist,    setShowChecklist]    = useState(false);
  const [tipoEmpleo,       setTipoEmpleo]       = useState<'dependiente' | 'independiente'>('dependiente');
  const [antiguedadMeses,  setAntiguedadMeses]  = useState<number>(12);
  const [obsCredito,       setObsCredito]       = useState('');
  const [checklistBool,    setChecklistBool]    = useState<ChecklistBool>(checklistVacio());
  const [aprobandoCredito, setAprobandoCredito] = useState(false);
  const [creditoError,     setCreditoError]     = useState('');
  const [creditoFactura,   setCreditoFactura]   = useState<string | null>(null);

  useEffect(() => {
    productosAPI.getAll()
      .then(data => setBackendProducts(data.map(mapApiProduct)))
      .catch(() => setBackendProducts([]));
    clientesAPI.getAll()
      .then(setClients)
      .catch(() => setClients([]));
    categoriasAPI.getAll()
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  const filteredProducts = selectedCategoryId !== ''
    ? backendProducts.filter(p => p.categoria_id === selectedCategoryId)
    : backendProducts;

  // Al seleccionar un cliente del listado, autocompleta nombre y NIT/CI
  const handleCustomerSelect = (clientId: string) => {
    setSelectedCustomerId(clientId);
    const client = clients.find(c => String(c.id) === clientId);
    if (client) {
      setCustomerName(`${client.nombre} ${client.apellido}`.trim());
      setCustomerNit(client.nit_ci ?? '');
    }
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

  // Calculo del descuento VIP (bloques de 200 Bs, regla relajada: descuento <= subtotal)
  const selectedClient = clients.find(c => String(c.id) === selectedCustomerId);
  const descuentoDisponible = Number(selectedClient?.descuento_disponible ?? 0);
  const blocksAvailable = Math.floor(descuentoDisponible / 200);
  const blocksInPurchase = Math.floor(subtotal / 200);
  const blocksToApply = Math.min(blocksAvailable, blocksInPurchase);
  const descuentoMaxAplicable = blocksToApply * 200;
  const descuentoAplicado = aplicarDescuento ? descuentoMaxAplicable : 0;
  const totalFinal = subtotal - descuentoAplicado;
  const esVip = !!selectedClient?.es_vip;

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
        usuario: parseInt(user.id),
        detalles: cart.map(item => ({
          producto: parseInt(item.product.id),
          cantidad: item.quantity,
          precio_unitario: item.product.price,
        })),
        pagos: [{ monto: totalFinal, metodo: metodoPagoMap[paymentMethod] }],
        aplicar_descuento_vip: aplicarDescuento,
      });
      // Refresca clientes para reflejar el nuevo descuento_disponible y total_acumulado
      clientesAPI.getAll().then(setClients).catch(() => {});

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
        setSelectedCategoryId('');
        setShowSuccessModal(false);
      }, 2000);
    } catch (error) {
      console.error('Error al completar venta:', error);
      alert(`Error al registrar venta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const paymentMethods = [
    { value: 'cash',    label: 'Efectivo',   icon: Banknote },
    { value: 'card',    label: 'Tarjeta',    icon: CreditCard },
    { value: 'qr',      label: 'Código QR',  icon: QrCode },
    { value: 'credito', label: 'Al crédito', icon: Wallet },
  ];

  // ── Al Crédito: validaciones + simulación + bloqueo ─────────────────────────
  // Solo se permite crédito si hay UN producto en el carrito (cantidad libre)
  // y el cliente está registrado. La cantidad total del ítem se pasa al backend.
  const itemUnico       = cart.length === 1 ? cart[0] : null;
  const precioUnitCred  = itemUnico ? itemUnico.product.price : 0;
  const cantidadCred    = itemUnico ? itemUnico.quantity : 0;
  const creditoElegible = paymentMethod === 'credito'
    && !!itemUnico
    && !!selectedCustomerId
    && precioUnitCred >= 1 && precioUnitCred <= 15000;

  // Al elegir crédito + cliente, chequeamos si está bloqueado (mora / tope 3 activos)
  useEffect(() => {
    if (paymentMethod !== 'credito' || !selectedCustomerId) {
      setBloqueoCredito(null);
      return;
    }
    creditoAPI.bloqueo(Number(selectedCustomerId))
      .then(setBloqueoCredito)
      .catch(() => setBloqueoCredito(null));
  }, [paymentMethod, selectedCustomerId]);

  // Simular el plan cada vez que cambie el producto/cantidad con crédito
  useEffect(() => {
    if (!creditoElegible) { setSimulacion(null); return; }
    creditoAPI.simular(precioUnitCred, cantidadCred)
      .then(setSimulacion)
      .catch(() => setSimulacion(null));
  }, [creditoElegible, precioUnitCred, cantidadCred]);

  const abrirChecklistCredito = () => {
    if (!creditoElegible || !simulacion?.elegible) return;
    setTipoEmpleo('dependiente');
    setAntiguedadMeses(12);
    setObsCredito('');
    setChecklistBool(checklistVacio());
    setCreditoError('');
    setShowChecklist(true);
  };

  const confirmarCredito = async () => {
    if (!itemUnico || !selectedCustomerId) return;
    setCreditoError('');
    setAprobandoCredito(true);
    try {
      const payload: CreditoAtomicoPayload = {
        cliente:          Number(selectedCustomerId),
        producto:         Number(itemUnico.product.id),
        cantidad:         itemUnico.quantity,
        tipo_empleo:      tipoEmpleo,
        antiguedad_meses: antiguedadMeses,
        observaciones:    obsCredito.trim() || undefined,
        checklist:        checklistBool,
      };
      const plan = await creditoAPI.crearDesdeVenta(payload);
      setShowChecklist(false);
      setCreditoFactura(plan.numero_factura ?? null);
      setShowSuccessModal(true);
      // Refrescar productos (stock) y clientes (VIP)
      productosAPI.getAll().then(data => setBackendProducts(data.map(mapApiProduct))).catch(() => {});
      clientesAPI.getAll().then(setClients).catch(() => {});
      setTimeout(() => {
        setCart([]); setCustomerName(''); setCustomerNit('');
        setSelectedCustomerId(''); setPaymentMethod('cash');
        setSelectedCategoryId(''); setShowSuccessModal(false); setCreditoFactura(null);
      }, 3500);
    } catch (e) {
      setCreditoError(e instanceof Error ? e.message : 'No se pudo aprobar el crédito.');
    } finally {
      setAprobandoCredito(false);
    }
  };

  // Cerrar modales con Esc
  useEscapeKey(showInvoice, () => setShowInvoice(false));
  useEscapeKey(showSuccessModal, () => setShowSuccessModal(false));
  useEscapeKey(showChecklist, () => setShowChecklist(false));

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
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900">Datos del Cliente</h2>
              {esVip && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-full text-xs font-bold">
                  <Crown className="w-3.5 h-3.5" /> Cliente VIP
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map(client => (
                  <option key={client.id} value={String(client.id)}>
                    {client.es_vip ? '★ ' : ''}{client.nombre} {client.apellido}
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

            {/* Info VIP del cliente seleccionado */}
            {selectedClient && (descuentoDisponible > 0 || (selectedClient.total_acumulado ?? 0) > 0) && (
              <div className="mt-3 p-3 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-700">
                  <strong>Acumulado:</strong> Bs {Number(selectedClient.total_acumulado ?? 0).toFixed(2)}
                </span>
                {descuentoDisponible > 0 && (
                  <span className="text-green-700 font-semibold">
                    🎁 Descuento disponible: Bs {descuentoDisponible.toFixed(2)}
                  </span>
                )}
              </div>
            )}
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
                <div className="flex flex-col sm:flex-row gap-4">
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

                  <div className="w-full sm:w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex sm:items-end">
                    <button
                      onClick={addToCart}
                      disabled={!selectedProduct}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  <div key={item.product.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-4 bg-gray-50 rounded-lg">
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

                    <div className="text-right ml-auto">
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

              <div className="pt-4 border-t border-gray-200 space-y-2">
                {/* Descuento VIP solo si NO es crédito */}
                {paymentMethod !== 'credito' && descuentoMaxAplicable > 0 && (
                  <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={aplicarDescuento}
                        onChange={e => setAplicarDescuento(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="font-medium text-yellow-900">
                        Aplicar descuento VIP (Bs {descuentoMaxAplicable.toFixed(2)})
                      </span>
                    </label>
                  </div>
                )}

                {paymentMethod !== 'credito' && descuentoAplicado > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>Bs {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-700 font-semibold">
                      <span>Descuento VIP</span>
                      <span>− Bs {descuentoAplicado.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {/* Bloque Al Crédito: alertas + simulación + CTA distinto */}
                {paymentMethod === 'credito' ? (
                  <div className="space-y-2">
                    {!selectedCustomerId && (
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-xs rounded-lg px-3 py-2">
                        Elegí un cliente registrado (obligatorio para crédito).
                      </div>
                    )}
                    {cart.length > 1 && (
                      <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-xs rounded-lg px-3 py-2">
                        El crédito se otorga sobre <strong>un solo producto</strong> por venta. Dejá un solo ítem en el carrito.
                      </div>
                    )}
                    {itemUnico && (precioUnitCred < 1 || precioUnitCred > 15000) && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                        El precio unitario debe estar entre Bs 1 y Bs 15.000 para calificar a crédito.
                      </div>
                    )}
                    {bloqueoCredito?.motivo === 'mora' && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>El cliente tiene <strong>{bloqueoCredito.cuotas_vencidas} cuota(s) vencida(s)</strong>. Regularizar antes de otorgar más créditos.</span>
                      </div>
                    )}
                    {bloqueoCredito?.motivo === 'limite' && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>El cliente ya tiene <strong>{bloqueoCredito.activos} créditos activos</strong> (máximo 3).</span>
                      </div>
                    )}
                    {bloqueoCredito?.motivo === 'advertencia' && (
                      <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>El cliente ya tiene 2 créditos activos. Este sería el 3ro (tope). El siguiente será rechazado.</span>
                      </div>
                    )}

                    {simulacion && !simulacion.elegible && (
                      <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                        {simulacion.motivo || 'El producto no califica a crédito.'}
                      </div>
                    )}

                    {simulacion?.elegible && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5 text-sm">
                        <div className="flex justify-between text-gray-700">
                          <span>Precio base ({cantidadCred} u.)</span>
                          <span>Bs {Number(simulacion.precio_base).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                          <span>Recargo (+{Number(simulacion.recargo_pct).toFixed(0)}%)</span>
                          <span>Bs {(Number(simulacion.precio_financiado) - Number(simulacion.precio_base)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-blue-900 pt-1 border-t border-blue-200">
                          <span>Total financiado</span>
                          <span>Bs {Number(simulacion.precio_financiado).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-green-700 font-semibold">
                          <span>Inicial (efectivo)</span>
                          <span>Bs {Number(simulacion.inicial).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                          <span>Saldo en cuotas</span>
                          <span>{simulacion.n_cuotas} × Bs {Number(simulacion.monto_cuota).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={abrirChecklistCredito}
                      disabled={
                        !creditoElegible
                        || !simulacion?.elegible
                        || bloqueoCredito?.motivo === 'mora'
                        || bloqueoCredito?.motivo === 'limite'
                      }
                      className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2 mt-2"
                    >
                      <Wallet className="w-5 h-5" />
                      Aprobar crédito
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between mb-4 pt-2 border-t border-gray-100">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-gray-900">{totalFinal.toFixed(2)} Bs</span>
                    </div>
                    <button
                      onClick={handleShowInvoice}
                      disabled={cart.length === 0 || !customerName || !customerNit}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      Ver Factura
                    </button>
                  </>
                )}
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
                <p className="text-gray-600">SantaCruzComputer</p>
                <p className="text-sm text-gray-500">Av. Arce 2147, La Paz</p>
                <p className="text-sm text-gray-500">NIT: 1234567890</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
                    <th className="hidden sm:table-cell text-right py-2 px-3 text-sm font-medium text-gray-600">Precio</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.product.id} className="border-b border-gray-100">
                      <td className="py-3 px-3 text-sm">{item.product.name}</td>
                      <td className="py-3 px-3 text-sm text-right">{item.quantity}</td>
                      <td className="hidden sm:table-cell py-3 px-3 text-sm text-right">{item.product.price.toFixed(2)} Bs</td>
                      <td className="py-3 px-3 text-sm text-right font-medium">
                        {(item.product.price * item.quantity).toFixed(2)} Bs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="space-y-2 mb-6">
                {descuentoAplicado > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal:</span>
                      <span>{subtotal.toFixed(2)} Bs</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-700 font-semibold">
                      <span>Descuento VIP:</span>
                      <span>− {descuentoAplicado.toFixed(2)} Bs</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                  <span>TOTAL:</span>
                  <span>{totalFinal.toFixed(2)} Bs</span>
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
              {creditoFactura ? <Wallet className="w-8 h-8 text-green-600" /> : <ShoppingCart className="w-8 h-8 text-green-600" />}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {creditoFactura ? '¡Crédito aprobado!' : '¡Venta Completada!'}
            </h3>
            {creditoFactura ? (
              <>
                <p className="text-gray-600 text-sm">Factura de la inicial:</p>
                <p className="text-lg font-bold text-blue-700 mt-1">{creditoFactura}</p>
                <p className="text-xs text-gray-500 mt-3">Se envió al cliente por correo con el cronograma de cuotas.</p>
              </>
            ) : (
              <p className="text-gray-600">La venta se ha registrado exitosamente</p>
            )}
          </div>
        </div>
      )}

      {/* Modal Checklist Al Crédito */}
      {showChecklist && itemUnico && simulacion?.elegible && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowChecklist(false)}>
          <div className="bg-white rounded-xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-purple-600" /> Aprobar crédito
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {itemUnico.product.name} — {itemUnico.quantity} u. × Bs {itemUnico.product.price.toFixed(2)}
                </p>
              </div>
              <button onClick={() => setShowChecklist(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              {/* Resumen financiero */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1">
                <p className="text-xs text-blue-700 font-semibold tracking-wider">RESUMEN FINANCIERO</p>
                <div className="flex justify-between"><span>Total financiado</span><span className="font-semibold">Bs {Number(simulacion.precio_financiado).toFixed(2)}</span></div>
                <div className="flex justify-between text-green-700"><span>Inicial (efectivo)</span><span className="font-semibold">Bs {Number(simulacion.inicial).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Saldo</span><span>{simulacion.n_cuotas} × Bs {Number(simulacion.monto_cuota).toFixed(2)}</span></div>
              </div>

              {/* Tipo de empleo */}
              <div>
                <label className="block font-medium text-gray-700 mb-1">Tipo de empleo</label>
                <div className="flex gap-2">
                  {(['dependiente', 'independiente'] as const).map(t => (
                    <button key={t} onClick={() => setTipoEmpleo(t)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border ${tipoEmpleo === t ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-600'}`}>
                      {t === 'dependiente' ? 'Dependiente' : 'Independiente'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Antigüedad laboral (meses)</label>
                <input type="number" min={0} value={antiguedadMeses}
                  onChange={e => setAntiguedadMeses(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              {/* Documentos */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-700 tracking-wider">DOCUMENTOS ENTREGADOS</p>
                <p className="text-xs text-gray-500">Marcar los que el cliente presentó físicamente.</p>

                {/* Comunes */}
                {[
                  ['ci_solicitante',   'CI del solicitante'],
                  ['ci_conyuge',       'CI del cónyuge (si aplica)'],
                  ['factura_servicios','Factura de servicios (domicilio)'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={checklistBool[key as keyof ChecklistBool]}
                      onChange={e => setChecklistBool({ ...checklistBool, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}

                {tipoEmpleo === 'dependiente' && [
                  ['boletas_pago',     '3 últimas boletas de pago'],
                  ['extracto_gestora', 'Extracto AFP / Gestora Pública'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={checklistBool[key as keyof ChecklistBool]}
                      onChange={e => setChecklistBool({ ...checklistBool, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}

                {tipoEmpleo === 'independiente' && [
                  ['facturas_ultimo_ano',     'Facturas del último año'],
                  ['estados_financieros',     'Estados financieros'],
                  ['nit',                     'NIT'],
                  ['croquis_domicilio',       'Croquis de domicilio'],
                  ['croquis_negocio',         'Croquis de negocio'],
                  ['respaldos_patrimoniales', 'Respaldos patrimoniales (autos/inmuebles)'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={checklistBool[key as keyof ChecklistBool]}
                      onChange={e => setChecklistBool({ ...checklistBool, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
                <textarea rows={2} value={obsCredito} onChange={e => setObsCredito(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              {bloqueoCredito?.motivo === 'advertencia' && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Este cliente llegará al tope de 3 créditos activos. El próximo será rechazado.</span>
                </div>
              )}

              {creditoError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                  {creditoError}
                </div>
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-gray-200">
              <button onClick={() => setShowChecklist(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancelar
              </button>
              <button disabled={aprobandoCredito} onClick={confirmarCredito}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {aprobandoCredito ? 'Aprobando…' : <><CheckCircle2 className="w-4 h-4" /> Confirmar y cobrar inicial</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
