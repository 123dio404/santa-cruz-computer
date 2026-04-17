import { Package, Eye } from 'lucide-react';
import { useState } from 'react';
import { mockProducts } from '../data/mockData';

interface Order {
  id: string;
  date: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  total: number;
  items: { productId: string; quantity: number; price: number }[];
}

const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    date: '2026-04-10',
    status: 'delivered',
    total: 1429.98,
    items: [
      { productId: '1', quantity: 1, price: 1299.99 },
      { productId: '3', quantity: 1, price: 129.99 }
    ]
  },
  {
    id: 'ORD-002',
    date: '2026-04-08',
    status: 'shipped',
    total: 139.98,
    items: [
      { productId: '4', quantity: 2, price: 69.99 }
    ]
  },
  {
    id: 'ORD-003',
    date: '2026-04-05',
    status: 'processing',
    total: 1059.97,
    items: [
      { productId: '2', quantity: 1, price: 599.99 },
      { productId: '5', quantity: 1, price: 449.99 }
    ]
  }
];

export function Orders() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getStatusBadge = (status: Order['status']) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      shipped: 'bg-purple-100 text-purple-700',
      delivered: 'bg-green-100 text-green-700'
    };

    const labels = {
      pending: 'Pendiente',
      processing: 'Procesando',
      shipped: 'Enviado',
      delivered: 'Entregado'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getProductById = (id: string) => {
    return mockProducts.find(p => p.id === id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis Pedidos</h1>
        <p className="text-gray-600">Historial de compras y seguimiento</p>
      </div>

      <div className="space-y-4">
        {mockOrders.map(order => (
          <div key={order.id} className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{order.id}</h3>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-sm text-gray-600">Fecha: {order.date}</p>
              </div>

              <div className="flex items-center gap-4 mt-4 md:mt-0">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-bold text-gray-900">${order.total.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalles
                </button>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto">
              {order.items.map((item, idx) => {
                const product = getProductById(item.productId);
                if (!product) return null;

                return (
                  <div key={idx} className="flex items-center gap-2 min-w-fit">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Detalles del Pedido</h2>
                <p className="text-sm text-gray-600 mt-1">{selectedOrder.id}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Estado:</span>
                {getStatusBadge(selectedOrder.status)}
              </div>

              {/* Date */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Fecha:</span>
                <span className="font-medium text-gray-900">{selectedOrder.date}</span>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Productos</h3>
                <div className="space-y-4">
                  {selectedOrder.items.map((item, idx) => {
                    const product = getProductById(item.productId);
                    if (!product) return null;

                    return (
                      <div key={idx} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-20 h-20 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-gray-600">Cantidad: {item.quantity}</span>
                            <span className="font-semibold text-gray-900">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${selectedOrder.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Tracking */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Estado del Envío</p>
                    <p className="text-sm text-blue-700 mt-1">
                      {selectedOrder.status === 'delivered' && 'Tu pedido ha sido entregado'}
                      {selectedOrder.status === 'shipped' && 'Tu pedido está en camino'}
                      {selectedOrder.status === 'processing' && 'Estamos preparando tu pedido'}
                      {selectedOrder.status === 'pending' && 'Hemos recibido tu pedido'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
