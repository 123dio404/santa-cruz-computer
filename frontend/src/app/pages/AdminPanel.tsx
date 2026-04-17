import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, RotateCcw, Search, AlertCircle } from 'lucide-react';

export function AdminPanel() {
  const { user, getAllUsers, resetUserPassword } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const users = getAllUsers();
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!selectedUserId || !newPassword) {
      setMessage('Por favor completa todos los campos');
      setMessageType('error');
      return;
    }

    if (resetUserPassword(selectedUserId, newPassword)) {
      setMessage(`✅ Contraseña del usuario reseteada correctamente. Nueva contraseña: ${newPassword}`);
      setMessageType('success');
      setNewPassword('');
      setShowResetForm(false);
      setSelectedUserId(null);
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Error al resetear la contraseña');
      setMessageType('error');
    }
  };

  // Only allow admin to access
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600">Solo los administradores pueden acceder a este panel</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-600">Gestionar usuarios y recuperación de contraseñas</p>
      </div>

      {/* Recovery Password Section */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recuperación de Contraseña</h2>
              <p className="text-sm text-gray-600">Ayuda a usuarios a recuperar sus contraseñas</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Search Users */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por usuario, email o nombre..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Users List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No se encontraron usuarios
              </div>
            ) : (
              filteredUsers.map(u => (
                <div
                  key={u.id}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedUserId === u.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 bg-gray-50'
                  }`}
                  onClick={() => setSelectedUserId(u.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{u.name} {u.lastName}</h3>
                      <p className="text-sm text-gray-600">@{u.username}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' :
                        u.role === 'employee' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role === 'admin' ? 'Administrador' : u.role === 'employee' ? 'Empleado' : 'Cliente'}
                      </span>
                    </div>
                    <RotateCcw className={`w-5 h-5 ${selectedUserId === u.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reset Form */}
          {selectedUserId && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ingresa la nueva contraseña"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    💡 Sugerencia: usa "123456" para mantener consistencia
                  </p>
                </div>

                {message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    messageType === 'success'
                      ? 'bg-green-50 border border-green-200 text-green-700'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetForm(false);
                      setSelectedUserId(null);
                      setNewPassword('');
                      setMessage('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resetear Contraseña
                  </button>
                </div>
              </form>
            </div>
          )}

          {!selectedUserId && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center text-gray-600 text-sm">
              👆 Selecciona un usuario para resetear su contraseña
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Información Importante</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Cuando resetees la contraseña, el usuario recibirá la nueva contraseña</li>
          <li>✓ El usuario debe cambiar su contraseña en el próximo login</li>
          <li>✓ Esta acción es registrada en el sistema para auditoría</li>
          <li>✓ No se puede resetear contraseña de otros administradores</li>
        </ul>
      </div>
    </div>
  );
}
