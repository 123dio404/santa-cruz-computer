import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Shield, RefreshCw } from 'lucide-react';
import { usuariosAPI, ApiUser } from '../services/api';
import { useUsers } from '../context/UsersContext';

type BackendRole = 'admin' | 'vendedor' | 'cliente';

const roleLabels: Record<BackendRole, string> = { admin: 'Administrador', vendedor: 'Vendedor', cliente: 'Cliente' };
const roleColors: Record<BackendRole, string> = { admin: 'bg-purple-100 text-purple-700', vendedor: 'bg-blue-100 text-blue-700', cliente: 'bg-gray-100 text-gray-700' };

export function Users() {
  const { allUsers: users, loading, fetchUsers } = useUsers();

  useEffect(() => { fetchUsers(); }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', telefono: '',
    fecha_nacimiento: '', ciudad: '',
    role: 'cliente' as BackendRole, activo: true,
  });

  const handleOpenModal = (user?: ApiUser) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name, email: user.email, telefono: user.telefono ?? '',
        fecha_nacimiento: user.fecha_nacimiento ?? '', ciudad: user.ciudad ?? '',
        role: user.role, activo: user.activo,
      });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', telefono: '', fecha_nacimiento: '', ciudad: '', role: 'cliente', activo: true });
    }
    setIsModalOpen(true);
  };

  const handleClose = () => { setIsModalOpen(false); setEditingUser(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        telefono:         formData.telefono         || null,
        fecha_nacimiento: formData.fecha_nacimiento || null,
        ciudad:           formData.ciudad           || null,
      };
      if (editingUser) {
        await usuariosAPI.update(editingUser.id, payload);
      } else {
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
    try {
      await usuariosAPI.delete(id);
      await fetchUsers();
    } catch { alert('Error al eliminar usuario'); }
  };

  const roleStats = {
    admin: users.filter(u => u.role === 'admin').length,
    vendedor: users.filter(u => u.role === 'vendedor').length,
    cliente: users.filter(u => u.role === 'cliente').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-600">Gestión de usuarios y roles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refrescar
          </button>
          <button onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-5 h-5" /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['admin', 'vendedor', 'cliente'] as BackendRole[]).map(role => (
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Nombre</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Usuario</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Email</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Teléfono</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Ciudad</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Nacimiento</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Rol</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Activo</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4 font-medium text-gray-900">{user.name}</td>
                  <td className="py-4 px-4 font-mono text-sm text-gray-700">{user.username || '—'}</td>
                  <td className="py-4 px-4 text-gray-600">{user.email}</td>
                  <td className="py-4 px-4 text-gray-600">{user.telefono || '—'}</td>
                  <td className="py-4 px-4 text-gray-600">{user.ciudad || '—'}</td>
                  <td className="py-4 px-4 text-gray-600 text-sm">
                    {user.fecha_nacimiento ? new Date(user.fecha_nacimiento + 'T00:00:00').toLocaleDateString('es-BO') : '—'}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${roleColors[user.role as BackendRole] ?? 'bg-gray-100 text-gray-700'}`}>
                      {roleLabels[user.role as BackendRole] ?? user.role}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.activo ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
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
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {[
                ['name',  'Nombre completo', 'text'],
                ['email', 'Email',           'email'],
                ['telefono', 'Teléfono',     'text'],
                ['ciudad',   'Ciudad',       'text'],
              ].map(([k, l, t]) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input type={t} value={(formData as any)[k]}
                    onChange={e => setFormData({ ...formData, [k]: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required={k === 'name' || k === 'email'} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
                <input type="date" value={formData.fecha_nacimiento}
                  onChange={e => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as BackendRole })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="cliente">Cliente</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="activo" checked={formData.activo}
                  onChange={e => setFormData({ ...formData, activo: e.target.checked })}
                  className="w-4 h-4 text-blue-600" />
                <label htmlFor="activo" className="text-sm font-medium text-gray-700">Usuario activo</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : editingUser ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
