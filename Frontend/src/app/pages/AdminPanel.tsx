/**
 * AdminPanel.tsx - Panel de Administración (Solo Admin)
 *
 * Panel de control para la recuperación de contraseñas del sistema.
 * Solo accesible para el rol 'admin'.
 *
 * Recuperación de Contraseñas:
 *   El admin puede resetear la contraseña de cualquier usuario o cliente.
 *   Busca en la lista combinada de usuarios (tabla usuario) y clientes (tabla cliente).
 *   Al confirmar, hace PATCH al backend con la nueva contraseña.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usuariosAPI, clientesAPI, API_BASE_URL, ApiUser, ApiCliente } from '../services/api';
import { RotateCcw, Search, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function AdminPanel() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // ── Usuarios / clientes ──────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<ApiUser[]>([]);
  const [clientes, setClientes] = useState<ApiCliente[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ id: number; username: string; tabla: 'usuario' | 'cliente' } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const showMsg = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  // Cargar usuarios y clientes reales
  useEffect(() => {
    Promise.all([usuariosAPI.getAll(), clientesAPI.getAll()])
      .then(([u, c]) => { setUsuarios(u); setClientes(c); })
      .catch(() => showMsg('Error al cargar usuarios', 'error'))
      .finally(() => setLoadingUsers(false));
  }, []);

  // ── Filtro ─────────────────────────────────────────────────────────────────
  const allForPassword = [
    ...usuarios.map(u => ({
      id: u.id, username: u.username,
      nombre: u.nombre_completo || u.name,
      rol: u.rol || u.role,
      tabla: 'usuario' as const,
    })),
    ...clientes.filter(c => c.usuario_login).map(c => ({
      id: c.id, username: c.usuario_login!,
      nombre: `${c.nombre} ${c.apellido}`.trim(),
      rol: 'cliente',
      tabla: 'cliente' as const,
    })),
  ];

  const filteredPassword = allForPassword.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Resetear contraseña (admin) ────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) {
      showMsg('Completa todos los campos', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showMsg('La contraseña debe tener al menos 8 caracteres', 'error');
      return;
    }
    setResetting(true);
    try {
      const endpoint = selectedUser.tabla === 'cliente'
        ? `${API_BASE_URL}/users/clientes/${selectedUser.id}/`
        : `${API_BASE_URL}/users/${selectedUser.id}/`;
      const token = localStorage.getItem('access_token');
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      showMsg(`✅ Contraseña de "${selectedUser.username}" actualizada`, 'success');
      setSelectedUser(null);
      setNewPassword('');
    } catch {
      showMsg('Error al resetear la contraseña', 'error');
    } finally {
      setResetting(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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
        <p className="text-gray-600">Recuperación de contraseñas de usuarios y clientes</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Recuperación de Contraseña</h2>
              <p className="text-sm text-gray-600">Resetea la contraseña de cualquier usuario o cliente</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por usuario o nombre..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {loadingUsers ? (
              <div className="text-center py-8 text-gray-400">Cargando usuarios...</div>
            ) : filteredPassword.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No se encontraron usuarios</div>
            ) : (
              filteredPassword.map(u => (
                <div
                  key={`${u.tabla}-${u.id}`}
                  onClick={() => setSelectedUser({ id: u.id, username: u.username, tabla: u.tabla })}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedUser?.username === u.username
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{u.nombre}</p>
                      <p className="text-sm text-gray-500">@{u.username}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.rol === 'admin' ? 'bg-red-100 text-red-700' :
                        u.rol === 'vendedor' || u.rol === 'employee' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {u.rol === 'admin' ? 'Administrador' : u.rol === 'vendedor' || u.rol === 'employee' ? 'Vendedor' : 'Cliente'}
                      </span>
                    </div>
                    <RotateCcw className={`w-5 h-5 ${selectedUser?.username === u.username ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedUser && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-3">
                Reseteando contraseña de: <strong>@{selectedUser.username}</strong>
              </p>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Nueva contraseña (mínimo 8 caracteres)"
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    messageType === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    {message}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setSelectedUser(null); setNewPassword(''); setMessage(''); }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {resetting ? 'Guardando...' : 'Resetear Contraseña'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {!selectedUser && !loadingUsers && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center text-gray-600 text-sm">
              👆 Selecciona un usuario para resetear su contraseña
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
