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

import { createContext, useContext, useState, ReactNode } from 'react';

// ============ TIPOS Y INTERFACES ============

/** Tipos de roles disponibles en el sistema */
export type UserRole = 'admin' | 'employee' | 'client';

/** Opciones de género para el registro de usuarios */
export type UserGender = 'masculino' | 'femenino' | 'otro';

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
  login: (username: string, password: string) => boolean;  // Función para iniciar sesión
  logout: () => void;            // Función para cerrar sesión
  isAuthenticated: boolean;      // Booleano: ¿hay usuario logueado?
  register: (userData: Omit<User, 'id'>, password: string) => { success: boolean; message: string };  // Registrar nuevo usuario
  checkUsernameAvailable: (username: string) => boolean;   // Verificar si un usuario está disponible
  getAllUsers: () => User[];     // Obtener lista de todos los usuarios (para admin)
  resetUserPassword: (userId: string, newPassword: string) => boolean;  // Resetear contraseña (admin)
}

// Crear el contexto de autenticación
const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    email: 'admin@store.com',
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
    email: 'employee@store.com',
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
    email: 'cliente@store.com',
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
  // Estado del usuario actual logueado
  const [user, setUser] = useState<User | null>(null);
  
  // Base de datos simulada de usuarios registrados
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(mockUsers);

  /**
   * Función LOGIN - Verifica credenciales y autentica al usuario
   * 
   * @param username - Usuario ingresado
   * @param password - Contraseña ingresada
   * @returns true si el login fue exitoso, false si falló
   * 
   * EN PRODUCCIÓN:
   * - Aquí se enviaría una petición al backend (API)
   * - La contraseña nunca se envía directamente (se usa token JWT)
   * - El backend valida las credenciales en la base de datos real
   */
  const login = (username: string, password: string): boolean => {
    // Buscar usuario por username
    const foundUser = registeredUsers.find(u => u.username === username);
    
    // Verificar que exista y contraseña sea correcta (mock: todas son '123456')
    if (foundUser && password === '123456') {
      setUser(foundUser);  // Guardar usuario en estado
      return true;
    }
    return false;
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
  const register = (userData: Omit<User, 'id'>, password: string): { success: boolean; message: string } => {
    // Validar que el usuario no exista
    if (!checkUsernameAvailable(userData.username)) {
      return { success: false, message: 'El usuario ya existe' };
    }

    // Validar que el email no esté registrado
    if (registeredUsers.find(u => u.email === userData.email)) {
      return { success: false, message: 'El correo ya está registrado' };
    }

    // En mock, solo aceptamos '123456' como contraseña
    if (password !== '123456') {
      return { success: false, message: 'La contraseña debe ser 123456' };
    }

    // Crear nuevo usuario con ID generado
    const newUser: User = {
      id: String(registeredUsers.length + 1),
      ...userData,
    };

    // Agregar a la lista de usuarios
    setRegisteredUsers([...registeredUsers, newUser]);
    
    // Loguear automáticamente al nuevo usuario
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
      resetUserPassword 
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
