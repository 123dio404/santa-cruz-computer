/**
 * useBackendAuth.ts - Hook para autenticación con Backend Django
 * 
 * Maneja login, registro y comunicación con el servidor Django
 */

import { useState } from 'react';
import { authAPI, usuariosAPI, ApiUser } from '../services/api';

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: ApiUser;
  tokens?: {
    access: string;
    refresh: string;
  };
}

export const useBackendAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Login con email (conecta al backend)
   */
  const backendLogin = async (email: string): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await authAPI.login(email);
      
      // Guardar tokens en localStorage
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      localStorage.setItem('user', JSON.stringify(response.user));

      return {
        success: true,
        message: 'Login exitoso',
        user: response.user,
        tokens: {
          access: response.access,
          refresh: response.refresh,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en login';
      setError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Obtener token de localStorage
   */
  const getAccessToken = (): string | null => {
    return localStorage.getItem('access_token');
  };

  /**
   * Logout
   */
  const backendLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setError(null);
  };

  /**
   * Obtener usuario almacenado
   */
  const getStoredUser = (): ApiUser | null => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  };

  /**
   * Crear nuevo usuario en backend
   */
  const backendRegister = async (userData: Partial<ApiUser>): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);

    try {
      const newUser = await usuariosAPI.create(userData);
      return {
        success: true,
        message: 'Registro exitoso',
        user: newUser,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en registro';
      setError(message);
      return {
        success: false,
        message,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    backendLogin,
    backendLogout,
    backendRegister,
    getAccessToken,
    getStoredUser,
    loading,
    error,
  };
};
