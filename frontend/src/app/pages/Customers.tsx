import { useState } from 'react';
import { Users, Eye, Gift, X } from 'lucide-react';
import { mockCustomers, mockSales, mockProducts, Customer } from '../data/mockData';

export function Customers() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const getCustomerSales = (customerId: string) => {
    return mockSales.filter(sale => sale.customerId === customerId);
  };

  const getProductById = (id: string) => {
    return mockProducts.find(p => p.id === id);
  };

  const canRedeemReward = (totalPurchases: number) => {
    return totalPurchases >= 2500;
  };

  const getLoyaltyBadge = (totalPurchases: number) => {
    if (totalPurchases >= 5000) {
      return { label: 'VIP', color: 'bg-purple-100 text-purple-700' };
    } else if (totalPurchases >= 2500) {
      return { label: 'Premium', color: 'bg-blue-100 text-blue-700' };
    }
    return { label: 'Regular', color: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-gray-600">Gestión de clientes y programa de lealtad</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-900">{mockCustomers.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Clientes VIP</p>
              <p className="text-2xl font-bold text-gray-900">
                {mockCustomers.filter(c => c.totalPurchases >= 5000).length}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Gift className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Clientes Premium</p>
              <p className="text-2xl font-bold text-gray-900">
                {mockCustomers.filter(c => c.totalPurchases >= 2500 && c.totalPurchases < 5000).length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Gift className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Ventas Totales</p>
              <p className="text-2xl font-bold text-gray-900">
                {mockCustomers.reduce((sum, c) => sum + c.totalPurchases, 0).toFixed(2)} Bs
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cliente</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">NIT/CI</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Contacto</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Total Compras</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Nivel</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Puntos</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mockCustomers.map(customer => {
                const badge = getLoyaltyBadge(customer.totalPurchases);
                return (
                  <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-900">{customer.nit}</td>
                    <td className="py-4 px-4 text-gray-600">{customer.phone}</td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-gray-900">{customer.totalPurchases.toFixed(2)} Bs</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium text-gray-900">{customer.loyaltyPoints}</span>
                        {canRedeemReward(customer.totalPurchases) && (
                          <Gift className="w-4 h-4 text-orange-500" />
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedCustomer.name}</h2>
                <p className="text-sm text-gray-600 mt-1">NIT/CI: {selectedCustomer.nit}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <p className="font-medium text-gray-900">{selectedCustomer.email}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Teléfono</p>
                  <p className="font-medium text-gray-900">{selectedCustomer.phone}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Compras</p>
                  <p className="text-xl font-bold text-gray-900">{selectedCustomer.totalPurchases.toFixed(2)} Bs</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Puntos de Lealtad</p>
                  <p className="text-xl font-bold text-gray-900">{selectedCustomer.loyaltyPoints}</p>
                </div>
              </div>

              {/* Loyalty Benefits */}
              {canRedeemReward(selectedCustomer.totalPurchases) && (
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Gift className="w-6 h-6 text-orange-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-orange-900 mb-2">Beneficios Disponibles</h3>
                      <ul className="text-sm text-orange-800 space-y-1">
                        <li>• 10% de descuento en periféricos (máx 1000 Bs)</li>
                        <li>• Canjear recompensa: Teclado, Mouse o Audífonos</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase History */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Historial de Compras</h3>
                <div className="space-y-4">
                  {getCustomerSales(selectedCustomer.id).map(sale => (
                    <div key={sale.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{sale.id}</span>
                          <span className="text-sm text-gray-600">{sale.date}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            sale.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' :
                            sale.paymentMethod === 'qr' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {sale.paymentMethod === 'card' ? 'Tarjeta' :
                             sale.paymentMethod === 'qr' ? 'QR' : 'Efectivo'}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900">{sale.total.toFixed(2)} Bs</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {sale.products.map((item, idx) => {
                          const product = getProductById(item.productId);
                          if (!product) return null;

                          return (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-10 h-10 rounded object-cover"
                              />
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{product.name}</p>
                                <p className="text-gray-600">Cantidad: {item.quantity}</p>
                              </div>
                              <p className="font-medium text-gray-900">
                                {(item.price * item.quantity).toFixed(2)} Bs
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
