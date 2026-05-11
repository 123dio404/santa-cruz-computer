import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Shield, RefreshCw, Users as UsersIcon, UserCheck } from 'lucide-react';
import { usuariosAPI, clientesAPI, ApiUser, ApiCliente } from '../services/api';
import { useUsers } from '../context/UsersContext';

/**
 * Users.tsx - Gestión de Usuarios y Clientes (Solo Admin)
 *
 * Permite al administrador ver, crear, editar y eliminar usuarios del sistema
 * (admin y vendedores) y clientes registrados.
 *
 * TABS:
 * - Personal: Lista de usuarios del sistema (admin, vendedores) — tabla usuario en BD
 * - Clientes: Lista de clientes registrados — tabla cliente en BD
 *
 * OPERACIONES SOBRE PERSONAL:
 * - Crear nuevo usuario con nombre, username, email, teléfono, ciudad, rol y contraseña
 * - Editar datos de usuario existente (la contraseña es opcional al editar)
 * - Eliminar usuario del sistema
 * - Ver estado activo/inactivo del usuario
 *
 * OPERACIONES SOBRE CLIENTES:
 * - Editar datos del cliente (nombre, apellido, contacto, NIT/CI, razón social)
 * - Eliminar cliente
 *
 * NOTA: Los clientes se registran solos desde la página de login.
 * Los usuarios del sistema solo los puede crear el admin desde aquí.
 */

// ── Tipo formulario clientes ──────────────────────────────────────────────────
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
};

const emptyClienteForm: ClienteForm = {
  nombre: '', apellido: '', usuario_login: '', correo: '',
  sexo: '', ciudad: '', telefono: '', fecha_nacimiento: '',
  nit_ci: '', razon_social: '',
};

// ── Tipos ─────────────────────────────────────────────────────────────────────
type Tab        = 'personal' | 'clientes';
type BackendRole = 'admin' | 'vendedor';

const roleLabels: Record<BackendRole, string> = { admin: 'Administrador', vendedor: 'Vendedor' };
const roleColors: Record<BackendRole, string> = {
  admin:    'bg-purple-100 text-purple-700',
  vendedor: 'bg-blue-100 text-blue-700',
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

// ── Componente ────────────────────────────────────────────────────────────────
export function Users() {
  const { allUsers: users, loading, fetchUsers } = useUsers();

  const [activeTab, setActiveTab]           = useState<Tab>('personal');
  const [clientes, setClientes]             = useState<ApiCliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingUser, setEditingUser]       = useState<ApiUser | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [formData, setFormData]             = useState<FormData>(emptyForm);

  // ── Estado modal clientes ──────────────────────────────────────────────────
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [editingCliente, setEditingCliente]         = useState<ApiCliente | null>(null);
  const [clienteForm, setClienteForm]               = useState<ClienteForm>(emptyClienteForm);
  const [savingCliente, setSavingCliente]           = useState(false);

  useEffect(() => { fetchUsers(); fetchClientes(); }, []);

  useEffect(() => {
    if (activeTab === 'clientes') fetchClientes();
  }, [activeTab]);

  const fetchClientes = async () => {
    setLoadingClientes(true);
    try { setClientes(await clientesAPI.getAll()); }
    catch { /* silencioso */ }
    finally { setLoadingClientes(false); }
  };

  // ── Modal de creación/edición de usuario ───────────────────────────────────
  // Si se pasa un usuario, precarga sus datos para editar; si no, abre el modal vacío para crear
  const handleOpenModal = (user?: ApiUser) => {
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

  const handleClose = () => { setIsModalOpen(false); setEditingUser(null); };

  // Guarda el usuario (crea o edita según si editingUser tiene valor)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleDeleteCliente = async (id: number) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    try { await clientesAPI.delete(id); await fetchClientes(); }
    catch { alert('Error al eliminar cliente'); }
  };

  // ── Modal edición de cliente ───────────────────────────────────────────────
  const handleOpenClienteModal = (c: ApiCliente) => {
    setEditingCliente(c);
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
    });
    setIsClienteModalOpen(true);
  };

  const handleCloseClienteModal = () => { setIsClienteModalOpen(false); setEditingCliente(null); };

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
      });
      await fetchClientes();
      handleCloseClienteModal();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally { setSavingCliente(false); }
  };

  const clienteField = (key: keyof ClienteForm, label: string, type = 'text') => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={clienteForm[key]}
        onChange={e => setClienteForm({ ...clienteForm, [key]: e.target.value })}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  const roleStats = {
    admin:    users.filter(u => u.rol === 'admin').length,
    vendedor: users.filter(u => u.rol === 'vendedor').length,
  };

  // ── Helper campo formulario ────────────────────────────────────────────────
  const field = (key: keyof FormData, label: string, type = 'text', required = false, placeholder = '') => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={formData[key] as string}
        onChange={e => setFormData({ ...formData, [key]: e.target.value })}
        placeholder={placeholder} required={required}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600">Gestión de personal y clientes registrados</p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={activeTab === 'personal' ? fetchUsers : fetchClientes}
            disabled={activeTab === 'personal' ? loading : loadingClientes}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm">
            <RefreshCw className={`w-4 h-4 ${(loading || loadingClientes) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
          {activeTab === 'personal' && (
            <button onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Nuevo Usuario</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de estadísticas — solo tab personal */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {(['admin', 'vendedor'] as BackendRole[]).map(role => (
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

      {/* Tarjeta de estadística — solo tab clientes */}
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

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
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
                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium text-gray-600">NIT/CI</th>
                    <th className="hidden lg:table-cell text-left py-3 px-4 font-medium text-gray-600">Razón Social</th>
                    <th className="hidden md:table-cell text-left py-3 px-4 font-medium text-gray-600">Email</th>
                    <th className="hidden lg:table-cell text-left py-3 px-4 font-medium text-gray-600">Teléfono</th>
                    <th className="hidden xl:table-cell text-left py-3 px-4 font-medium text-gray-600">Ciudad</th>
                    <th className="hidden xl:table-cell text-left py-3 px-4 font-medium text-gray-600">Nacimiento</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{c.nombre} {c.apellido}</td>
                      <td className="hidden sm:table-cell py-3 px-4 font-mono text-gray-700">{c.usuario_login || '—'}</td>
                      <td className="hidden md:table-cell py-3 px-4 text-gray-600">{c.nit_ci || '—'}</td>
                      <td className="hidden lg:table-cell py-3 px-4 text-gray-600">{c.razon_social || '—'}</td>
                      <td className="hidden md:table-cell py-3 px-4 text-gray-600">{c.correo || '—'}</td>
                      <td className="hidden lg:table-cell py-3 px-4 text-gray-600">{c.telefono || '—'}</td>
                      <td className="hidden xl:table-cell py-3 px-4 text-gray-600">{c.ciudad || '—'}</td>
                      <td className="hidden xl:table-cell py-3 px-4 text-gray-500">
                        {c.fecha_nacimiento
                          ? new Date(c.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-BO')
                          : '—'}
                      </td>
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
                {clienteField('nombre', 'Nombre *')}
                {clienteField('apellido', 'Apellido *')}
              </div>
              {clienteField('usuario_login', 'Usuario (login)')}
              {clienteField('correo', 'Email', 'email')}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {clienteField('nit_ci', 'NIT / CI')}
                {clienteField('razon_social', 'Razón Social')}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {clienteField('telefono', 'Teléfono', 'tel')}
                {clienteField('ciudad', 'Ciudad')}
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
                {clienteField('fecha_nacimiento', 'Nacimiento', 'date')}
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
              {field('nombre_completo', 'Nombre completo *', 'text', true)}
              {field('username', 'Nombre de usuario *', 'text', true, 'ej: jperez')}
              {field('email', 'Email', 'email')}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {field('telefono', 'Teléfono')}
                {field('ciudad', 'Ciudad')}
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
                </select>
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                  <input type="password" value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
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
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : editingUser ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
