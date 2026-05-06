import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, RotateCcw, Search, AlertCircle, Unlock, Eye, EyeOff } from 'lucide-react';
import type { AccountLockStatus } from '../context/AuthContext';

export function AdminPanel() {
  const { user, getAllUsers, resetUserPassword, getAccountLockStatus, unlockAccount, getLoginAttempt } = useAuth();
  const [activeTab, setActiveTab] = useState<'password' | 'security'>('password');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [showPassword, setShowPassword] = useState(false);

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
      setSelectedUserId(null);
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Error al resetear la contraseña');
      setMessageType('error');
    }
  };

  const handleUnlockAccount = (username: string) => {
    if (unlockAccount(username)) {
      setMessage(`✅ Cuenta de ${username} desbloqueada correctamente`);
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Error al desbloquear la cuenta');
      setMessageType('error');
    }
  };

  const getLockStatusBadge = (lockStatus: AccountLockStatus) => {
    switch (lockStatus) {
      case 'unlocked':
        return {
          label: 'Desbloqueada',
          color: 'bg-green-100 text-green-700',
          icon: '🔓',
        };
      case 'temporary_1min':
        return {
          label: 'Bloqueada (1 min)',
          color: 'bg-yellow-100 text-yellow-700',
          icon: '⏰',
        };
      case 'temporary_5min':
        return {
          label: 'Bloqueada (5 min)',
          color: 'bg-orange-100 text-orange-700',
          icon: '⏳',
        };
      case 'permanent':
        return {
          label: 'Bloqueada Permanentemente',
          color: 'bg-red-100 text-red-700',
          icon: '🔒',
        };
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
        <p className="text-gray-600">Gestionar usuarios, seguridad y recuperación de contraseñas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'password'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Recuperación de Contraseña
          </div>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Seguridad de Cuentas
          </div>
        </button>
      </div>

      {/* TAB 1: Password Recovery */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Recuperación de Contraseña</h2>
                <p className="text-sm text-gray-600">Ayuda a usuarios a recuperar o cambiar sus contraseñas</p>
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
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ingresa la nueva contraseña"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      💡 Sugerencia: usa "123456" para mantener consistencia en testing
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
      )}

      {/* TAB 2: Account Security */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-red-100">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Seguridad de Cuentas</h2>
                <p className="text-sm text-gray-600">Gestionar bloqueos y intentos de acceso</p>
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

            {/* Users Security Status Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Intentos Fallidos</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No se encontraron usuarios
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const lockStatus = getAccountLockStatus(u.username);
                      const loginAttempt = getLoginAttempt(u.username);
                      const badge = getLockStatusBadge(lockStatus);

                      return (
                        <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{u.name} {u.lastName}</p>
                              <p className="text-xs text-gray-500">@{u.username}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge?.color}`}>
                              {badge?.icon} {badge?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">
                              {loginAttempt?.failedAttempts || 0}
                            </span>
                            {lockStatus !== 'unlocked' && (
                              <p className="text-xs text-gray-500">
                                (Bloqueado)
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {lockStatus !== 'unlocked' && (
                              <button
                                onClick={() => handleUnlockAccount(u.username)}
                                className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                              >
                                <Unlock className="w-4 h-4" />
                                Desbloquear
                              </button>
                            )}
                            {lockStatus === 'unlocked' && (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">📋 Leyenda de Estados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium mr-2">🔓 Desbloqueada</span>
                  <span className="text-gray-600">Cuenta normal, sin bloqueos</span>
                </div>
                <div>
                  <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium mr-2">⏰ Bloqueada (1 min)</span>
                  <span className="text-gray-600">Bloqueada tras 3 intentos fallidos</span>
                </div>
                <div>
                  <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium mr-2">⏳ Bloqueada (5 min)</span>
                  <span className="text-gray-600">Bloqueada tras 6 intentos fallidos</span>
                </div>
                <div>
                  <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium mr-2">🔒 Bloqueada Permanentemente</span>
                  <span className="text-gray-600">Más de 6 intentos, requiere admin</span>
                </div>
              </div>
            </div>

            {message && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${
                messageType === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Información del Sistema de Seguridad</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>✓ <strong>3 intentos fallidos:</strong> Bloqueo temporal de 1 minuto</li>
          <li>✓ <strong>6 intentos fallidos:</strong> Bloqueo temporal de 5 minutos</li>
          <li>✓ <strong>Más de 6 intentos:</strong> Bloqueo permanente (requiere admin para desbloquear)</li>
          <li>✓ Los intentos se resetean cuando el usuario inicia sesión correctamente</li>
          <li>✓ La contraseña predeterminada para testing es: <code className="bg-white px-2 py-1 rounded">123456</code></li>
          <li>✓ No se puede resetear contraseña de otros administradores desde aquí</li>
        </ul>
      </div>
    </div>
  );
}
