/**
 * UsersContext.tsx - Contexto Global de Usuarios del Sistema
 *
 * Maneja la lista de usuarios (personal: admin y vendedores) disponible
 * en toda la aplicación sin necesidad de hacer fetch repetido en cada página.
 *
 * DATOS QUE PROVEE:
 * - allUsers: todos los usuarios del sistema (admin + vendedores)
 * - clients: filtro de allUsers donde rol === 'cliente'
 * - loading: estado de carga
 * - fetchUsers: recarga la lista desde el backend
 * - updateUserRole: cambia el rol de un usuario y recarga la lista
 *
 * CÓMO USAR:
 * import { useUsers } from '../context/UsersContext'
 * const { allUsers, loading } = useUsers()
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usuariosAPI, ApiUser } from '../services/api';

interface UsersContextType {
  allUsers: ApiUser[];
  clients: ApiUser[];
  loading: boolean;
  fetchUsers: () => Promise<void>;
  updateUserRole: (id: number, newRole: string) => Promise<void>;
}

const UsersContext = createContext<UsersContextType | undefined>(undefined);

export function UsersProvider({ children }: { children: ReactNode }) {
  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga todos los usuarios del backend al iniciar la app
  const fetchUsers = async () => {
    setLoading(true);
    try {
      setAllUsers(await usuariosAPI.getAll());
    } catch {
      // Los componentes muestran su propio estado de error
    } finally {
      setLoading(false);
    }
  };

  // Se ejecuta una sola vez al montar el proveedor
  useEffect(() => { fetchUsers(); }, []);

  // Cambia el rol de un usuario y recarga la lista para reflejar el cambio
  const updateUserRole = async (id: number, newRole: string) => {
    await usuariosAPI.updateRole(id, newRole);
    await fetchUsers();
  };

  // Subconjunto de allUsers filtrado por rol cliente
  const clients = allUsers.filter(u => u.role === 'cliente');

  return (
    <UsersContext.Provider value={{ allUsers, clients, loading, fetchUsers, updateUserRole }}>
      {children}
    </UsersContext.Provider>
  );
}

/**
 * Hook useUsers - Accede al contexto de usuarios desde cualquier componente
 * Lanza error si se usa fuera del UsersProvider
 */
export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error('useUsers must be used within UsersProvider');
  return ctx;
}
