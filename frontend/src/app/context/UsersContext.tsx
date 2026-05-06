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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      setAllUsers(await usuariosAPI.getAll());
    } catch {
      // silently ignore; components show their own error state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateUserRole = async (id: number, newRole: string) => {
    await usuariosAPI.updateRole(id, newRole);
    await fetchUsers();
  };

  const clients = allUsers.filter(u => u.role === 'cliente');

  return (
    <UsersContext.Provider value={{ allUsers, clients, loading, fetchUsers, updateUserRole }}>
      {children}
    </UsersContext.Provider>
  );
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error('useUsers must be used within UsersProvider');
  return ctx;
}
