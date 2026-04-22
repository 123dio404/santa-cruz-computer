/**
 * AuthContext.tsx - Manejo Global de Autenticación
 * 
 * Este archivo es el CORAZÓN de la autenticación de la aplicación.
 * Aquí se manejan:
 * - Login/Logout de usuarios
 * - Registro de nuevos usuarios
 * - Recuperación de contraseñas
 * - Estado global del usuario logueado
 * - Control de permisos por rol (admin, employee, client)
 * 
 * React Context es una forma de compartir datos entre componentes sin pasar props manualmente.
 * 
 * ROLES DE USUARIO:
 * - admin: Administrador - Acceso total a todas las funciones
 * - employee: Empleado - Acceso a inventario, ventas y clientes
 * - client: Cliente - Acceso solo a la tienda y sus pedidos
 */

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// ============ TIPOS Y INTERFACES ============

export type UserRole = 'admin' | 'employee' | 'client';
export type UserGender = 'masculino' | 'femenino' | 'otro';

export interface User {
  id: string;
  name: string;
  lastName: string;
  username: string;
  email: string;
  gender: UserGender;
  city: string;
  phone: string;
  birthDate: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  register: (userData: any, password: string) => Promise<{ success: boolean; message: string }>;
  checkUsernameAvailable: (username: string) => boolean;
  forgotPassword: (username: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (username: string, token: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = 'http://localhost:8000/api/usuarios';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const userData: User = {
          id: data.user.persona.id_persona,
          name: data.user.persona.nombre,
          lastName: '', // Simplificado
          username: data.user.username,
          email: data.user.persona.correo,
          gender: 'masculino',
          city: '',
          phone: data.user.persona.telefono,
          birthDate: '',
          role: data.user.rol,
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', data.token);
        return { success: true, message: 'Login exitoso' };
      } else {
        return { success: false, message: data.error || 'Error en el inicio de sesión' };
      }
    } catch (error) {
      return { success: false, message: 'No se pudo conectar con el servidor' };
    }
  };

  const logout = async () => {
    if (user) {
      await fetch(`${API_URL}/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
    }
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const register = async (userData: any, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_URL}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userData, password }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, message: 'Registro exitoso' };
      } else {
        return { success: false, message: data.error || 'Error en el registro' };
      }
    } catch (error) {
      return { success: false, message: 'No se pudo conectar con el servidor' };
    }
  };

  const forgotPassword = async (username: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_URL}/forgot-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      return { success: response.ok, message: data.message || data.error };
    } catch (error) {
      return { success: false, message: 'Error de conexión' };
    }
  };

  const resetPassword = async (username: string, token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_URL}/reset-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, token, new_password: newPassword }),
      });
      const data = await response.json();
      return { success: response.ok, message: data.message || data.error };
    } catch (error) {
      return { success: false, message: 'Error de conexión' };
    }
  };

  const checkUsernameAvailable = (username: string): boolean => {
    return true; // Simplificado para la demo
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user, 
      register, 
      checkUsernameAvailable,
      forgotPassword,
      resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
