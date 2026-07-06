import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Shield, RefreshCw, Users as UsersIcon, UserCheck, Eye, EyeOff, Crown } from 'lucide-react';
import { usuariosAPI, clientesAPI, ApiUser, ApiCliente } from '../services/api';
import { useUsers } from '../context/UsersContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

/**
 * Users.tsx - Gestión de Usuarios y Clientes (Solo Admin)
 *
 * Permite al administrador ver, crear, editar y eliminar usuarios del sistema
 * (admin y vendedores) y clientes registrados.
 *
 * TABS:
 * - Personal: Lista de usuarios del sistema (admin, vendedores) — tabla usuario en BD
 * - Clientes: Lista de clientes registrados — tabla cliente en BD
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Tab        = 'personal' | 'clientes';
type BackendRole = 'admin' | 'vendedor' | 'tecnico';

const roleLabels: Record<BackendRole, string> = { admin: 'Administrador', vendedor: 'Vendedor', tecnico: 'Técnico' };
const roleColors: Record<BackendRole, string> = {
  admin:    'bg-purple-100 text-purple-700',
  vendedor: 'bg-blue-100 text-blue-700',
  tecnico:  'bg-teal-100 text-teal-700',
};

type FormData = {
  nombre_completo: string;
  username:        string;
  email:           string;
  telefono:        string;
  ciudad:          string;
  fecha_nacimiento:string;
  rol:             BackendRole;
  activo:          boolean;
  password:        string;
};

const emptyForm: FormData = {
  nombre_completo: '', username: '', email: '',
  telefono: '', ciudad: '', fecha_nacimiento: '',
  rol: 'vendedor', activo: true, password: '',
};

type ClienteForm = {
  nombre:           string;
  apellido:         string;
  usuario_login:    string;
  correo:           string;
  sexo:             string;
  ciudad:           string;
  telefono:         string;
  fecha_nacimiento: string;
  nit_ci:           string;
  razon_social:     string;
  password:         string;
};

const emptyClienteForm: ClienteForm = {
  nombre: '', apellido: '', usuario_login: '', correo: '',
  sexo: '', ciudad: '', telefono: '', fecha_nacimiento: '',
  nit_ci: '', razon_social: '', password: '',
};

// ── Componente ────────────────────────────────────────────────────────────────
export function Users() {
  const { allUsers: users, loading, fetchUsers } = useUsers();

  const [activeTab, setActiveTab]             = useState<Tab>('personal');
  const [clientes, setClientes]               = useState<ApiCliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // ── Estado modal usuario (crear / editar) ─────────────────────────────────
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingUser, setEditingUser]   = useState<ApiUser | null>(null);
  const [saving, setSaving]             = useState(false);
  const [formData, setFormData]         = useState<FormData>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [userErrors, setUserErrors]     = useState<{ username?: string; email?: string }>({});

  // ── Estado modal cliente editar ───────────────────────────────────────────
  const [isClienteModalOpen, setIsClienteModalOpen]   = useState(false);
  const [editingCliente, setEditingCliente]           = useState<ApiCliente | null>(null);
  const [clienteForm, setClienteForm]                 = useState<ClienteForm>(emptyClienteForm);
  const [savingCliente, setSavingCliente]             = useState(false);
  const [showClienteEditPassword, setShowClienteEditPassword] = useState(false);

  // ── Estado modal cliente crear ────────────────────────────────────────────
  const [isCrearClienteModalOpen, setIsCrearClienteModalOpen] = useState(false);
  const [crearClienteForm, setCrearClienteForm]               = useState<ClienteForm>(emptyClienteForm);
  const [savingCrearCliente, setSavingCrearCliente]           = useState(false);
  const [showCrearClientePassword, setShowCrearClientePassword] = useState(false);
  const [clienteCrearErrors, setClienteCrearErrors]           = useState<{ usuario_login?: string; correo?: string }>({});

  useEffect(() => { fetchUsers(); fetchClientes(); }, []);
  useEffect(() => { if (activeTab === 'clientes') fetchClientes(); }, [activeTab]);

  const fetchClientes = async () => {
    setLoadingClientes(true);
    try { setClientes(await clientesAPI.getAll()); }
    catch { /* silencioso */ }
    finally { setLoadingClientes(false); }
  };

  // ── Validaciones unicidad cruzada (usuario) ────────────────────────────────
  const validateUserUsername = (value: string, currentUserId?: number) => {
    if (!value) { setUserErrors(e => ({ ...e, username: undefined })); return; }
    const inUsers    = users.some(u => u.username === value && u.id !== currentUserId);
    const inClientes = clientes.some(c => c.usuario_login === value);
    setUserErrors(e => ({
      ...e,
      username: (inUsers || inClientes) ? 'Este nombre de usuario ya está en uso.' : undefined,
    }));
  };

  const validateUserEmail = (value: string, currentUserId?: number) => {
    if (!value) { setUserErrors(e => ({ ...e, email: undefined })); return; }
    const inUsers    = users.some(u => u.email === value && u.id !== currentUserId);
    const inClientes = clientes.some(c => c.correo === value);
    setUserErrors(e => ({
      ...e,
      email: (inUsers || inClientes) ? 'Este email ya está en uso.' : undefined,
    }));
  };

  // ── Validaciones unicidad cruzada (cliente crear) ──────────────────────────
  const validateClienteLogin = (value: string) => {
    if (!value) { setClienteCrearErrors(e => ({ ...e, usuario_login: undefined })); return; }
    const inClientes = clientes.some(c => c.usuario_login === value);
    const inUsers    = users.some(u => u.username === value);
    setClienteCrearErrors(e => ({
      ...e,
      usuario_login: (inClientes || inUsers) ? 'Este usuario login ya está en uso.' : undefined,
    }));
  };

  const validateClienteCorreo = (value: string) => {
    if (!value) { setClienteCrearErrors(e => ({ ...e, correo: undefined })); return; }
    const inClientes = clientes.some(c => c.correo === value);
    const inUsers    = users.some(u => u.email === value);
    setClienteCrearErrors(e => ({
      ...e,
      correo: (inClientes || inUsers) ? 'Este correo ya está en uso.' : undefined,
    }));
  };

  // ── Modal usuario ──────────────────────────────────────────────────────────
  const handleOpenModal = (user?: ApiUser) => {
    // Refresca las listas para validar el username contra datos actuales (evita "ocupado" por lista vieja tras borrar)
    fetchUsers(); fetchClientes();
    setUserErrors({});
    setShowPassword(false);
    if (user) {
      setEditingUser(user);
      setFormData({
        nombre_completo:  user.nombre_completo,
        username:         user.username,
        email:            user.email            ?? '',
        telefono:         user.telefono         ?? '',
        ciudad:           user.ciudad           ?? '',
        fecha_nacimiento: user.fecha_nacimiento ?? '',
        rol:              (user.rol as BackendRole) || 'vendedor',
        activo:           user.activo,
        password:         '',
      });
    } else {
      setEditingUser(null);
      setFormData(emptyForm);
    }
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setUserErrors({});
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(userErrors).some(Boolean)) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        nombre_completo:  formData.nombre_completo,
        username:         formData.username,
        rol:              formData.rol,
        activo:           formData.activo,
        email:            formData.email            || null,
        telefono:         formData.telefono         || null,
        ciudad:           formData.ciudad           || null,
        fecha_nacimiento: formData.fecha_nacimiento || null,
      };
      if (formData.password) payload.password = formData.password;

      if (editingUser) {
        await usuariosAPI.update(editingUser.id, payload);
      } else {
        if (!formData.password) { alert('La contraseña es requerida.'); setSaving(false); return; }
        await usuariosAPI.create(payload);
      }
      await fetchUsers();
      handleClose();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try { await usuariosAPI.delete(id); await fetchUsers(); }
    catch { alert('Error al eliminar usuario'); }
  };

  // ── Modal editar cliente ───────────────────────────────────────────────────
  const handleOpenClienteModal = (c: ApiCliente) => {
    setEditingCliente(c);
    setShowClienteEditPassword(false);
    setClienteForm({
      nombre:           c.nombre           ?? '',
      apellido:         c.apellido         ?? '',
      usuario_login:    c.usuario_login    ?? '',
      correo:           c.correo           ?? '',
      sexo:             c.sexo             ?? '',
      ciudad:           c.ciudad           ?? '',
      telefono:         c.telefono         ?? '',
      fecha_nacimiento: c.fecha_nacimiento ?? '',
      nit_ci:           c.nit_ci           ?? '',
      razon_social:     c.razon_social     ?? '',
      password:         '',
    });
    setIsClienteModalOpen(true);
  };

  const handleCloseClienteModal = () => {
    setIsClienteModalOpen(false);
    setEditingCliente(null);
    setShowClienteEditPassword(false);
  };

  const handleSubmitCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCliente) return;
    setSavingCliente(true);
    try {
      await clientesAPI.update(editingCliente.id, {
        nombre:           clienteForm.nombre           || undefined,
        apellido:         clienteForm.apellido         || undefined,
        usuario_login:    clienteForm.usuario_login    || null,
        correo:           clienteForm.correo           || null,
        sexo:             clienteForm.sexo             || null,
        ciudad:           clienteForm.ciudad           || null,
        telefono:         clienteForm.telefono         || null,
        fecha_nacimiento: clienteForm.fecha_nacimiento || null,
        nit_ci:           clienteForm.nit_ci           || null,
        razon_social:     clienteForm.razon_social     || null,
        ...(clienteForm.password ? { password: clienteForm.password } : {}),
      });
      await fetchClientes();
      handleCloseClienteModal();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally { setSavingCliente(false); }
  };

  const handleDeleteCliente = async (id: number) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    try { await clientesAPI.delete(id); await fetchClientes(); }
    catch { alert('Error al eliminar cliente'); }
  };

  // ── Modal crear cliente ────────────────────────────────────────────────────
  const handleOpenCrearCliente = () => {
    // Refresca las listas para validar contra datos actuales (evita "ocupado" por lista vieja tras borrar)
    fetchUsers(); fetchClientes();
    setCrearClienteForm(emptyClienteForm);
    setClienteCrearErrors({});
    setShowCrearClientePassword(false);
    setIsCrearClienteModalOpen(true);
  };

  const handleCloseCrearCliente = () => {
    setIsCrearClienteModalOpen(false);
    setClienteCrearErrors({});
    setShowCrearClientePassword(false);
  };

  // Cerrar modales con Esc
  useEscapeKey(isModalOpen, handleClose);
  useEscapeKey(isClienteModalOpen && !!editingCliente, handleCloseClienteModal);
  useEscapeKey(isCrearClienteModalOpen, handleCloseCrearCliente);

  const handleSubmitCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(clienteCrearErrors).some(Boolean)) return;
    setSavingCrearCliente(true);
    try {
      await clientesAPI.create({
        nombre:           crearClienteForm.nombre           || undefined,
        apellido:         crearClienteForm.apellido         || undefined,
        usuario_login:    crearClienteForm.usuario_login    || null,
        correo:           crearClienteForm.correo           || null,
        sexo:             crearClienteForm.sexo             || null,
        ciudad:           crearClienteForm.ciudad           || null,
        telefono:         crearClienteForm.telefono         || null,
        fecha_nacimiento: crearClienteForm.fecha_nacimiento || null,
        nit_ci:           crearClienteForm.nit_ci           || null,
        razon_social:     crearClienteForm.razon_social     || null,
        ...(crearClienteForm.password ? { password: crearClienteForm.password } : {}),
      } as any);
      await fetchClientes();
      handleCloseCrearCliente();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally { setSavingCrearCliente(false); }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const roleStats = {
    admin:    users.filter(u => u.rol === 'admin').length,
    vendedor: users.filter(u => u.rol === 'vendedor').length,
    tecnico:  users.filter(u => u.rol === 'tecnico').length,
  };

  const hasUserErrors    = Object.values(userErrors).some(Boolean);
  const hasClienteErrors = Object.values(clienteCrearErrors).some(Boolean);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600">Gestión de personal y clientes registrados</p>
        </div>
        <button
          onClick={activeTab === 'personal' ? fetchUsers : fetchClientes}
          disabled={activeTab === 'personal' ? loading : loadingClientes}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm">
          <RefreshCw className={`w-4 h-4 ${(loading || loadingClientes) ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refrescar</span>
        </button>
      </div>

      {/* Estadísticas */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {(['admin', 'vendedor', 'tecnico'] as BackendRole[]).map(role => (
            <div key={role} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{roleLabels[role]}s</p>
                  <p className="text-2xl font-bold text-gray-900">{roleStats[role]}</p>
                </div>
                <div className={`p-3 rounded-lg ${roleColors[role].split(' ')[0]}`}>
                  <Shield className="w-6 h-6 text-gray-600" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'clientes' && (
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Clientes registrados</p>
                <p className="text-2xl font-bold text-gray-900">{clientes.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + botón Crear cuenta */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center border-b border-gray-200">
          <div className="flex flex-1">
            <button
              onClick={() => setActiveTab('personal')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'personal'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Shield className="w-4 h-4" />
              Personal
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                {users.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('clientes')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'clientes'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <UsersIcon className="w-4 h-4" />
              Clientes
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                {clientes.length}
              </span>
            </button>
          </div>
          {/* Botón Crear cuenta — cambia según tab */}
          <div className="px-4">
            <button
              onClick={activeTab === 'personal' ? () => handleOpenModal() : handleOpenCrearCliente}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus className="w-4 h-4" />
              {activeTab === 'personal' ? 'Nuevo usuario' : 'Nuevo cliente'}
            </button>
          </div>
        </div>

        {/* ── Tab: Personal ── */}
        {activeTab === 'personal' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No hay usuarios registrados.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre</th>
                    <th className="hidden sm:table-cell text-left py-3 px-4 font-medium text-gray-600">Usuario</th>
                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="hidden lg:table-cell text-left py-3 px-4 font-medium text-gray-600">Teléfono</th>
                    <th className="hidden lg:table-cell text-left py-3 px-4 font-medium text-gray-600">Ciudad</th>
                    <th className="hidden xl:table-cell text-left py-3 px-4 font-medium text-gray-600">Nacimiento</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Rol</th>
                    <th className="hidden sm:table-cell text-center py-3 px-4 font-medium text-gray-600">Activo</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{user.nombre_completo}</td>
                      <td className="hidden sm:table-cell py-3 px-4 font-mono text-gray-700">{user.username || '—'}</td>
                      <td className="hidden md:table-cell py-3 px-4 text-gray-600">{user.email || '—'}</td>
                      <td className="hidden lg:table-cell py-3 px-4 text-gray-600">{user.telefono || '—'}</td>
                      <td className="hidden lg:table-cell py-3 px-4 text-gray-600">{user.ciudad || '—'}</td>
                      <td className="hidden xl:table-cell py-3 px-4 text-gray-500">
                        {user.fecha_nacimiento
                          ? new Date(user.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-BO')
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${roleColors[user.rol as BackendRole] ?? 'bg-gray-100 text-gray-700'}`}>
                          {roleLabels[user.rol as BackendRole] ?? user.rol}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${user.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {user.activo ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenModal(user)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Tab: Clientes ── */}
        {activeTab === 'clientes' && (
          <div className="overflow-x-auto">
            {loadingClientes ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : clientes.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No hay clientes registrados.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Nombre completo</th>
                    <th className="hidden sm:table-cell text-left py-3 px-4 font-medium text-gray-600">Usuario</th>
                    <th className="hidden md:table-cell text-right py-3 px-4 font-medium text-gray-600">Acumulado</th>
                    <th className="hidden md:table-cell text-right py-3 px-4 font-medium text-gray-600">Bono</th>
                    <th className="hidden lg:table-cell text-left py-3 px-4 font-medium text-gray-600">NIT/CI</th>
                    <th className="hidden lg:table-cell text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="hidden xl:table-cell text-left py-3 px-4 font-medium text-gray-600">Teléfono</th>
                    <th className="hidden xl:table-cell text-left py-3 px-4 font-medium text-gray-600">Ciudad</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {c.es_vip && (
                            <span title="Cliente VIP" className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded text-xs font-bold">
                              <Crown className="w-3 h-3" /> VIP
                            </span>
                          )}
                          <span>{c.nombre} {c.apellido}</span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-4 font-mono text-gray-700">{c.usuario_login || '—'}</td>
                      <td className="hidden md:table-cell py-3 px-4 text-right text-gray-700">
                        Bs {Number(c.total_acumulado ?? 0).toFixed(2)}
                      </td>
                      <td className="hidden md:table-cell py-3 px-4 text-right">
                        {Number(c.descuento_disponible ?? 0) > 0 ? (
                          <span className="font-semibold text-green-700">
                            Bs {Number(c.descuento_disponible).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell py-3 px-4 text-gray-600">{c.nit_ci || '—'}</td>
                      <td className="hidden lg:table-cell py-3 px-4 text-gray-600">{c.correo || '—'}</td>
                      <td className="hidden xl:table-cell py-3 px-4 text-gray-600">{c.telefono || '—'}</td>
                      <td className="hidden xl:table-cell py-3 px-4 text-gray-600">{c.ciudad || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenClienteModal(c)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteCliente(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Modal crear / editar usuario ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nombre completo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input type="text" value={formData.nombre_completo} required
                  onChange={e => setFormData({ ...formData, nombre_completo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Username con validación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario *</label>
                <input type="text" value={formData.username} required placeholder="ej: jperez"
                  onChange={e => {
                    setFormData({ ...formData, username: e.target.value });
                    validateUserUsername(e.target.value, editingUser?.id);
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${userErrors.username ? 'border-red-400' : 'border-gray-300'}`} />
                {userErrors.username && <p className="text-red-600 text-xs mt-1">{userErrors.username}</p>}
              </div>

              {/* Email con validación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formData.email}
                  onChange={e => {
                    setFormData({ ...formData, email: e.target.value });
                    validateUserEmail(e.target.value, editingUser?.id);
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${userErrors.email ? 'border-red-400' : 'border-gray-300'}`} />
                {userErrors.email && <p className="text-red-600 text-xs mt-1">{userErrors.email}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={formData.telefono}
                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" value={formData.ciudad}
                    onChange={e => setFormData({ ...formData, ciudad: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                <input type="date" value={formData.fecha_nacimiento}
                  onChange={e => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select value={formData.rol}
                  onChange={e => setFormData({ ...formData, rol: e.target.value as BackendRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="vendedor">Vendedor</option>
                  <option value="admin">Administrador</option>
                  <option value="tecnico">Técnico</option>
                </select>
              </div>

              {/* Contraseña con mostrar/ocultar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña {!editingUser && '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {editingUser && <p className="text-xs text-gray-500 mt-1">Dejar vacío para no cambiar la contraseña.</p>}
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="activo" checked={formData.activo}
                  onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded" />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">Usuario activo</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || hasUserErrors}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : editingUser ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal editar cliente ── */}
      {isClienteModalOpen && editingCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Editar Cliente</h2>
              <button onClick={handleCloseClienteModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitCliente} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={clienteForm.nombre}
                    onChange={e => setClienteForm({ ...clienteForm, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input type="text" value={clienteForm.apellido}
                    onChange={e => setClienteForm({ ...clienteForm, apellido: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario (login)</label>
                <input type="text" value={clienteForm.usuario_login}
                  onChange={e => setClienteForm({ ...clienteForm, usuario_login: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={clienteForm.correo}
                  onChange={e => setClienteForm({ ...clienteForm, correo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT / CI</label>
                  <input type="text" value={clienteForm.nit_ci}
                    onChange={e => setClienteForm({ ...clienteForm, nit_ci: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                  <input type="text" value={clienteForm.razon_social}
                    onChange={e => setClienteForm({ ...clienteForm, razon_social: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={clienteForm.telefono}
                    onChange={e => setClienteForm({ ...clienteForm, telefono: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" value={clienteForm.ciudad}
                    onChange={e => setClienteForm({ ...clienteForm, ciudad: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                  <select value={clienteForm.sexo}
                    onChange={e => setClienteForm({ ...clienteForm, sexo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">— No especificado —</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nacimiento</label>
                  <input type="date" value={clienteForm.fecha_nacimiento}
                    onChange={e => setClienteForm({ ...clienteForm, fecha_nacimiento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
                <div className="relative">
                  <input type={showClienteEditPassword ? 'text' : 'password'} value={clienteForm.password}
                    onChange={e => setClienteForm({ ...clienteForm, password: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowClienteEditPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showClienteEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Dejar vacío para no cambiar la contraseña.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseClienteModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingCliente}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {savingCliente ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal crear cliente ── */}
      {isCrearClienteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nuevo Cliente</h2>
              <button onClick={handleCloseCrearCliente} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitCrearCliente} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={crearClienteForm.nombre} required
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input type="text" value={crearClienteForm.apellido} required
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, apellido: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Usuario login con validación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario login</label>
                <input type="text" value={crearClienteForm.usuario_login}
                  onChange={e => {
                    setCrearClienteForm({ ...crearClienteForm, usuario_login: e.target.value });
                    validateClienteLogin(e.target.value);
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${clienteCrearErrors.usuario_login ? 'border-red-400' : 'border-gray-300'}`} />
                {clienteCrearErrors.usuario_login && <p className="text-red-600 text-xs mt-1">{clienteCrearErrors.usuario_login}</p>}
              </div>

              {/* Correo con validación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                <input type="email" value={crearClienteForm.correo}
                  onChange={e => {
                    setCrearClienteForm({ ...crearClienteForm, correo: e.target.value });
                    validateClienteCorreo(e.target.value);
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${clienteCrearErrors.correo ? 'border-red-400' : 'border-gray-300'}`} />
                {clienteCrearErrors.correo && <p className="text-red-600 text-xs mt-1">{clienteCrearErrors.correo}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT / CI</label>
                  <input type="text" value={crearClienteForm.nit_ci}
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, nit_ci: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                  <input type="text" value={crearClienteForm.razon_social}
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, razon_social: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={crearClienteForm.telefono}
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, telefono: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input type="text" value={crearClienteForm.ciudad}
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, ciudad: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                  <select value={crearClienteForm.sexo}
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, sexo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">— No especificado —</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nacimiento</label>
                  <input type="date" value={crearClienteForm.fecha_nacimiento}
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, fecha_nacimiento: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Contraseña con mostrar/ocultar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <div className="relative">
                  <input type={showCrearClientePassword ? 'text' : 'password'} value={crearClienteForm.password}
                    onChange={e => setCrearClienteForm({ ...crearClienteForm, password: e.target.value })}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setShowCrearClientePassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCrearClientePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseCrearCliente}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingCrearCliente || hasClienteErrors}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {savingCrearCliente ? 'Guardando...' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
