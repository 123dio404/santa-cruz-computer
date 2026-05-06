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
import { validatePassword } from '../utils/passwordValidation';
import { authAPI, clearAuthToken, usuariosAPI } from '../services/api';

// Clave usada para guardar el usuario en localStorage
const STORAGE_KEY = 'user';

// ============ TIPOS Y INTERFACES ============

/** Tipos de roles disponibles en el sistema */
export type UserRole = 'admin' | 'employee' | 'client';

/** Opciones de género para el registro de usuarios */
export type UserGender = 'masculino' | 'femenino' | 'otro';

/** Estados de bloqueo de cuenta */
export type AccountLockStatus = 'unlocked' | 'temporary_1min' | 'temporary_5min' | 'permanent';

/**
 * Interfaz para rastrear intentos fallidos de login
 */
export interface LoginAttempt {
  userId?: string;
  username: string;
  failedAttempts: number;
  lockStatus: AccountLockStatus;
  lockUntil?: Date; // Para bloqueos temporales
}

/**
 * Interfaz User - Define la estructura de un usuario
 * Todos los usuarios en el sistema tienen estos campos
 */
export interface User {
  id: string;                    // Identificador único
  name: string;                  // Nombre del usuario
  lastName: string;              // Apellido
  username: string;              // Usuario único (para login)
  email: string;                 // Correo electrónico
  gender: UserGender;            // Sexo (masculino, femenino, otro)
  city: string;                  // Ciudad donde vive
  phone: string;                 // Número de teléfono
  birthDate: string;             // Fecha de nacimiento
  role: UserRole;                // Rol en el sistema
}

/**
 * Interfaz AuthContextType - Define qué funciones y datos están disponibles
 * en el contexto de autenticación (accessible desde cualquier componente)
 */
interface AuthContextType {
  user: User | null;             // Usuario actual logueado (null si no está logueado)
  login: (username: string, password: string) => Promise<{ success: boolean; message: string; loggedInUser?: User }>;  // Función para iniciar sesión
  logout: () => void;            // Función para cerrar sesión
  isAuthenticated: boolean;      // Booleano: ¿hay usuario logueado?
  register: (userData: Omit<User, 'id'>, password: string) => Promise<{ success: boolean; message: string }>;  // Registrar nuevo usuario
  checkUsernameAvailable: (username: string) => boolean;   // Verificar si un usuario está disponible
  getAllUsers: () => User[];     // Obtener lista de todos los usuarios (para admin)
  resetUserPassword: (userId: string, newPassword: string) => boolean;  // Resetear contraseña (admin)
  getAccountLockStatus: (username: string) => AccountLockStatus;  // Obtener estado de bloqueo
  unlockAccount: (username: string) => boolean;  // Desbloquear cuenta (admin)
  getLoginAttempt: (username: string) => LoginAttempt | null;  // Obtener info de intentos
}

// Crear el contexto de autenticación
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Lee el usuario guardado en localStorage (si existe)
 * Se usa para hidratar el estado al cargar la aplicación
 */
const getStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

// ============ DATOS MOCK (SIMULADOS) ============

/**
 * Usuarios de prueba predefinidos
 * En una app real, estos vendrían de una base de datos (Backend)
 * CONTRASEÑA DE PRUEBA: Todas usan '123456'
 */
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Jose',
    lastName: 'Caficc',
    username: 'josecaficc2026',
    email: 'admin@mail.com',
    gender: 'masculino',
    city: 'Santa Cruz',
    phone: '+591 123456789',
    birthDate: '1995-05-15',
    role: 'admin',
  },
  {
    id: '2',
    name: 'John',
    lastName: 'Employee',
    username: 'john_employee',
    email: 'vend@mail.com',
    gender: 'masculino',
    city: 'La Paz',
    phone: '+591 987654321',
    birthDate: '1990-03-20',
    role: 'employee',
  },
  {
    id: '3',
    name: 'Jane',
    lastName: 'Customer',
    username: 'jane_customer',
    email: 'cliente@mail.com',
    gender: 'femenino',
    city: 'Cochabamba',
    phone: '+591 555666777',
    birthDate: '1992-08-10',
    role: 'client',
  },
];

// ============ PROVEEDOR DE CONTEXTO ============

/**
 * AuthProvider - Componente que proporciona autenticación a toda la app
 * Debe envolver el componente App en main.tsx
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Estado del usuario actual logueado (hidratado desde localStorage si existe)
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  // Lista de usuarios para panel de admin (display-only, no se usa para auth)
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(mockUsers);

  // Rastreador de intentos fallidos (keyed by email, espeja los bloqueos del backend)
  const [loginAttempts, setLoginAttempts] = useState<Map<string, LoginAttempt>>(new Map());

  // Sincronizar usuario con localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      clearAuthToken();
    }
  }, [user]);

  /**
   * Función LOGIN - Verifica credenciales y autentica al usuario
   * 
   * @param username - Usuario ingresado
   * @param password - Contraseña ingresada
   * @returns { success: boolean, message: string } - Resultado del login
   * 
   * Maneja:
   * - Cuentas bloqueadas temporalmente o permanentemente
   * - Conteo de intentos fallidos
   * - Bloqueos progresivos (1 min, 5 min, permanente)
   */
  const login = async (username: string, password: string): Promise<{ success: boolean; message: string; loggedInUser?: User }> => {
    const now = new Date();
    let attempt = loginAttempts.get(username) ?? { username, failedAttempts: 0, lockStatus: 'unlocked' as AccountLockStatus };

    // Verificar bloqueo frontal (espeja el bloqueo del backend para UX inmediata)
    if (attempt.lockStatus !== 'unlocked') {
      if (attempt.lockStatus === 'permanent') {
        return { success: false, message: '❌ Esta cuenta está bloqueada permanentemente. Contacta al administrador.' };
      }
      if (attempt.lockUntil && attempt.lockUntil > now) {
        const mins = Math.ceil((attempt.lockUntil.getTime() - now.getTime()) / 1000 / 60);
        return { success: false, message: `⏰ Cuenta bloqueada. Intenta en ${mins} minuto${mins > 1 ? 's' : ''}.` };
      }
      // Bloqueo expirado → resetear
      attempt = { username, failedAttempts: 0, lockStatus: 'unlocked' };
    }

    // Llamada al backend — única fuente de verdad para credenciales
    try {
      const data = await authAPI.login(username, password);

      // Resetear contador de intentos
      setLoginAttempts(new Map(loginAttempts.set(username, { username, failedAttempts: 0, lockStatus: 'unlocked' })));

      // Mapear rol del backend al rol del frontend
      const roleMap: Record<string, UserRole> = { admin: 'admin', vendedor: 'employee', cliente: 'client' };
      const bu = data.user;
      const frontendUser: User = {
        id: String(bu.id),
        name: bu.name,
        lastName: '',
        username: bu.username || username,
        email: bu.email,
        gender: 'masculino' as UserGender,
        city: '',
        phone: bu.telefono || '',
        birthDate: '',
        role: (roleMap[bu.role] ?? 'client') as UserRole,
      };

      // Agregar a registeredUsers si no está (para AdminPanel)
      setRegisteredUsers(prev =>
        prev.find(u => u.email === frontendUser.email) ? prev : [...prev, frontendUser]
      );
      setUser(frontendUser);
      return { success: true, message: '✅ Sesión iniciada correctamente', loggedInUser: frontendUser };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';

      // Actualizar contador de intentos según respuesta del backend
      attempt.failedAttempts += 1;
      const count = attempt.failedAttempts;

      if (count > 6) {
        attempt.lockStatus = 'permanent';
      } else if (count >= 6) {
        attempt.lockStatus = 'temporary_5min';
        attempt.lockUntil = new Date(now.getTime() + 5 * 60 * 1000);
      } else if (count >= 3) {
        attempt.lockStatus = 'temporary_1min';
        attempt.lockUntil = new Date(now.getTime() + 1 * 60 * 1000);
      }
      setLoginAttempts(new Map(loginAttempts.set(username, attempt)));
      return { success: false, message: `❌ ${msg}` };
    }
  };

  /**
   * Función LOGOUT - Cierra la sesión del usuario actual
   */
  const logout = () => {
    setUser(null);
  };

  /**
   * Función CHECK USERNAME AVAILABLE
   * Verifica si un nombre de usuario está disponible para registro
   * 
   * @param username - Username a verificar
   * @returns true si está disponible, false si ya existe
   */
  const checkUsernameAvailable = (username: string): boolean => {
    return !registeredUsers.find(u => u.username === username);
  };

  /**
   * Función REGISTER - Registra un nuevo usuario en el sistema
   * 
   * @param userData - Objeto con todos los datos del usuario (sin id)
   * @param password - Contraseña elegida
   * @returns { success: boolean, message: string } - Resultado del registro
   * 
   * Validaciones:
   * - Usuario no debe existir
   * - Email no debe estar registrado
   * - Contraseña debe cumplir requisitos
   */
  const register = async (userData: Omit<User, 'id'>, password: string): Promise<{ success: boolean; message: string }> => {
    // Validaciones locales síncronas (rápidas, sin red)
    if (!checkUsernameAvailable(userData.username)) {
      return { success: false, message: 'El usuario ya existe' };
    }
    if (registeredUsers.find(u => u.email === userData.email)) {
      return { success: false, message: 'El correo ya está registrado' };
    }
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return { success: false, message: passwordValidation.message };
    }

    // Persistir en PostgreSQL con contraseña hasheada — si falla, NO se permite el login
    const roleMap: Record<UserRole, string> = { admin: 'admin', employee: 'vendedor', client: 'cliente' };
    try {
      await usuariosAPI.create({
        username:         userData.username,
        name:             `${userData.name} ${userData.lastName}`.trim(),
        email:            userData.email,
        telefono:         userData.phone         || null,
        fecha_nacimiento: userData.birthDate     || null,
        ciudad:           userData.city          || null,
        role:             roleMap[userData.role] as any,
        activo:           true,
        password,
      } as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error del servidor';
      return { success: false, message: `No se pudo crear la cuenta: ${msg}` };
    }

    // Backend confirmó 201 → obtener JWT e iniciar sesión con username
    try {
      await authAPI.login(userData.username, password);
    } catch { /* si falla el JWT, igual dejamos loguear */ }

    const newUser: User = {
      id: String(registeredUsers.length + 1),
      ...userData,
    };
    setRegisteredUsers([...registeredUsers, newUser]);
    setUser(newUser);
    return { success: true, message: 'Cuenta creada exitosamente' };
  };

  /**
   * Función GET ALL USERS
   * Obtiene la lista completa de usuarios (para admin)
   * @returns Array de todos los usuarios
   */
  const getAllUsers = (): User[] => {
    return registeredUsers;
  };

  /**
   * Función RESET USER PASSWORD
   * Permite al admin resetear la contraseña de otro usuario
   * 
   * @param userId - ID del usuario cuya contraseña se resetea
   * @param newPassword - Nueva contraseña
   * @returns true si fue exitoso, false si hubo error
   * 
   * EN PRODUCCIÓN:
   * - Se enviaría al backend para actualizar en BD
   * - La contraseña se enviaría hasheada (encriptada)
   * - Se podría registrar en logs para auditoría
   */
  const resetUserPassword = (userId: string, newPassword: string): boolean => {
    const userIndex = registeredUsers.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return false;
    }
    // En un app real, aquí se actualizaría la BD
    // Por ahora aceptamos cualquier password en el mock
    return true;
  };

  /**
   * Función GET ACCOUNT LOCK STATUS
   * Obtiene el estado de bloqueo de una cuenta
   * 
   * @param username - Usuario a verificar
   * @returns Estado de bloqueo (unlocked, temporary_1min, temporary_5min, permanent)
   */
  const getAccountLockStatus = (username: string): AccountLockStatus => {
    const attempt = loginAttempts.get(username);
    if (!attempt) return 'unlocked';

    // Si hay bloqueo temporal, verificar si ya expiró
    if (attempt.lockStatus !== 'unlocked' && attempt.lockUntil) {
      if (attempt.lockUntil <= new Date()) {
        // El bloqueo temporal expiró
        return 'unlocked';
      }
    }

    return attempt.lockStatus;
  };

  /**
   * Función UNLOCK ACCOUNT
   * Desbloquea una cuenta (función de admin)
   * 
   * @param username - Usuario a desbloquear
   * @returns true si fue desbloqueado, false si no existía
   */
  const unlockAccount = (username: string): boolean => {
    const attempt = loginAttempts.get(username);
    if (!attempt) return false;

    attempt.lockStatus = 'unlocked';
    attempt.failedAttempts = 0;
    attempt.lockUntil = undefined;
    setLoginAttempts(new Map(loginAttempts.set(username, attempt)));
    return true;
  };

  /**
   * Función GET LOGIN ATTEMPT
   * Obtiene la información de intentos de login de un usuario
   * 
   * @param username - Usuario a verificar
   * @returns Objeto con información de intentos o null
   */
  const getLoginAttempt = (username: string): LoginAttempt | null => {
    return loginAttempts.get(username) || null;
  };

  // ============ RETORNAR PROVEEDOR ============

  /**
   * Provider: Proporciona todo el contexto de autenticación a la app
   * El "value" es lo que cualquier componente puede acceder con useAuth()
   */
  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user, 
      register, 
      checkUsernameAvailable, 
      getAllUsers, 
      resetUserPassword,
      getAccountLockStatus,
      unlockAccount,
      getLoginAttempt
    }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook useAuth - Para acceder a autenticación desde cualquier componente
 * 
 * CÓMO USAR:
 * ```
 * import { useAuth } from '../context/AuthContext'
 * 
 * function MiComponente() {
 *   const { user, logout } = useAuth()
 *   
 *   return <div>Hola {user?.name}!</div>
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
