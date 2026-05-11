/**
 * AdminPanel.tsx - Panel de Administración (Solo Admin)
 *
 * Panel de control para la gestión de seguridad de las cuentas del sistema.
 * Solo accesible para el rol 'admin'.
 *
 * TABS:
 * - Recuperación de Contraseñas:
 *   El admin puede resetear la contraseña de cualquier usuario o cliente.
 *   Busca en la lista combinada de usuarios (tabla usuario) y clientes (tabla cliente).
 *   Al confirmar, hace PATCH al backend con la nueva contraseña.
 *
 * - Seguridad de Cuentas:
 *   Muestra todos los usuarios y clientes del sistema con su estado de bloqueo.
 *   Si una cuenta tiene intentos fallidos de login, aparece marcada.
 *   El admin puede desbloquear cuentas con un clic.
 *
 * DATOS EN TIEMPO REAL:
 * Los bloqueos de cuentas vienen del dict _failed en memoria del backend,
 * que registra intentos fallidos de login por username.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usuariosAPI, clientesAPI, authAPI, ApiUser, ApiCliente } from '../services/api';
import { Lock, RotateCcw, Search, AlertCircle, Unlock, Eye, EyeOff, RefreshCw } from 'lucide-react';

type BlockedEntry = { username: string; failed_attempts: number; estado: string };

type SecurityRow = {
  username: string;
  nombre: string;
  rol: string;
  email?: string;
  blocked?: BlockedEntry;
};

export function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'password' | 'security'>('password');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  // ── Tab contraseña ─────────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<ApiUser[]>([]);
  const [clientes, setClientes] = useState<ApiCliente[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<{ id: number; username: string; tabla: 'usuario' | 'cliente' } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Tab seguridad ──────────────────────────────────────────────────────────
  const [securityRows, setSecurityRows] = useState<SecurityRow[]>([]);
  const [loadingSecurity, setLoadingSecurity] = useState(true);

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

  // Cargar estado de seguridad
  const fetchSecurity = () => {
    setLoadingSecurity(true);
    Promise.all([usuariosAPI.getAll(), clientesAPI.getAll(), authAPI.blockedAccounts()])
      .then(([u, c, blocked]) => {
        const blockedMap = new Map(blocked.map(b => [b.username, b]));
        const rows: SecurityRow[] = [
          ...u.map(usr => ({
            username: usr.username,
            nombre: usr.nombre_completo || usr.name,
            rol: usr.rol || usr.role,
            email: usr.email || '',
            blocked: blockedMap.get(usr.username),
          })),
          ...c
            .filter(cl => cl.usuario_login)
            .map(cl => ({
              username: cl.usuario_login!,
              nombre: `${cl.nombre} ${cl.apellido}`.trim(),
              rol: 'cliente',
              email: cl.correo || '',
              blocked: blockedMap.get(cl.usuario_login!),
            })),
        ];
        setSecurityRows(rows);
      })
      .catch(() => showMsg('Error al cargar seguridad', 'error'))
      .finally(() => setLoadingSecurity(false));
  };

  useEffect(() => { fetchSecurity(); }, []);

  // ── Filtros ────────────────────────────────────────────────────────────────
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

  const filteredSecurity = securityRows.filter(r =>
    r.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase())
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
        ? `http://localhost:8000/api/v1/users/clientes/${selectedUser.id}/`
        : `http://localhost:8000/api/v1/users/${selectedUser.id}/`;
      const token = localStorage.getItem('access_token');
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(
          selectedUser.tabla === 'cliente'
            ? { password: newPassword }
            : { password_hash: newPassword }
        ),
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

  // ── Desbloquear cuenta ─────────────────────────────────────────────────────
  const handleUnlock = async (username: string) => {
    try {
      await authAPI.unblockAccount(username);
      showMsg(`✅ Cuenta "${username}" desbloqueada`, 'success');
      fetchSecurity();
    } catch {
      showMsg('Error al desbloquear la cuenta', 'error');
    }
  };

  const getBadge = (estado?: string) => {
    switch (estado) {
      case 'permanent':
        return { label: 'Bloqueada Permanente', color: 'bg-red-100 text-red-700', icon: '🔒' };
      case 'temporary_5min':
        return { label: 'Bloqueada (5 min)', color: 'bg-orange-100 text-orange-700', icon: '⏳' };
      case 'temporary_1min':
        return { label: 'Bloqueada (1 min)', color: 'bg-yellow-100 text-yellow-700', icon: '⏰' };
      default:
        return { label: 'Desbloqueada', color: 'bg-green-100 text-green-700', icon: '🔓' };
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
        <p className="text-gray-600">Gestionar usuarios, seguridad y recuperación de contraseñas</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => { setActiveTab('password'); setSearchTerm(''); }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'password' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Recuperación de Contraseña
          </div>
        </button>
        <button
          onClick={() => { setActiveTab('security'); setSearchTerm(''); }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'security' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Seguridad de Cuentas
          </div>
        </button>
      </div>

      {/* TAB 1: Recuperación de Contraseña */}
      {activeTab === 'password' && (
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
      )}

      {/* TAB 2: Seguridad de Cuentas */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-red-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-red-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Seguridad de Cuentas</h2>
                  <p className="text-sm text-gray-600">Estado de bloqueo de todos los usuarios y clientes</p>
                </div>
              </div>
              <button
                onClick={fetchSecurity}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Actualizar
              </button>
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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Rol</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Estado</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-gray-700">Intentos Fallidos</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSecurity ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Cargando...</td>
                    </tr>
                  ) : filteredSecurity.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No se encontraron usuarios</td>
                    </tr>
                  ) : (
                    filteredSecurity.map(row => {
                      const badge = getBadge(row.blocked?.estado);
                      const isBlocked = row.blocked?.estado && row.blocked.estado !== 'unlocked';
                      return (
                        <tr key={row.username} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{row.username}</p>
                            {row.email && (
                              <p className="text-xs text-gray-500">
                                {row.rol === 'cliente' ? 'Correo: ' : 'Email: '}{row.email}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.rol === 'admin' ? 'bg-red-100 text-red-700' :
                              row.rol === 'vendedor' || row.rol === 'employee' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {row.rol === 'admin' ? 'Administrador' : row.rol === 'vendedor' || row.rol === 'employee' ? 'Vendedor' : 'Cliente'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                              {badge.icon} {badge.label}
                            </span>
                          </td>
                          <td className="hidden md:table-cell px-4 py-3 text-gray-700 font-medium">
                            {row.blocked?.failed_attempts ?? 0}
                          </td>
                          <td className="px-4 py-3">
                            {isBlocked ? (
                              <button
                                onClick={() => handleUnlock(row.username)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                Desbloquear
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">📋 Leyenda de Estados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium mr-2">🔓 Desbloqueada</span><span className="text-gray-600">Sin bloqueos activos</span></div>
                <div><span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium mr-2">⏰ Bloqueada (1 min)</span><span className="text-gray-600">Tras 3 intentos fallidos</span></div>
                <div><span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium mr-2">⏳ Bloqueada (5 min)</span><span className="text-gray-600">Tras 6 intentos fallidos</span></div>
                <div><span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium mr-2">🔒 Bloqueada Permanente</span><span className="text-gray-600">Más de 6 intentos, requiere admin</span></div>
              </div>
            </div>

            {message && (
              <div className={`mt-4 p-3 rounded-lg text-sm ${
                messageType === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Información del Sistema de Seguridad</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>✓ <strong>3 intentos fallidos:</strong> Bloqueo temporal de 1 minuto</li>
          <li>✓ <strong>6 intentos fallidos:</strong> Bloqueo temporal de 5 minutos</li>
          <li>✓ <strong>Más de 6 intentos:</strong> Bloqueo permanente (requiere intervención de administrador)</li>
          <li>✓ Los intentos se resetean automáticamente al iniciar sesión correctamente</li>
          <li>✓ Los bloqueos temporales se limpian solos al expirar el tiempo</li>
        </ul>
      </div>
    </div>
  );
}
