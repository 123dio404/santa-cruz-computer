/**
 * App.tsx - Componente Raíz de la Aplicación
 * 
 * Este es el punto de entrada principal de la aplicación React.
 * Aquí se configuran los dos proveedores globales más importantes:
 * 
 * 1. AuthProvider: Maneja toda la lógica de autenticación y usuarios
 *    - Login/Logout
 *    - Registro de nuevos usuarios
 *    - Recuperación de contraseñas
 *    - Gestión de datos del usuario actual
 * 
 * 2. RouterProvider: Maneja las rutas y navegación de la aplicación
 *    - Define qué página se muestra en cada ruta
 *    - Controla el acceso a páginas según el rol del usuario
 */

import { RouterProvider } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { AuditProvider } from './context/AuditContext';
import { UsersProvider } from './context/UsersContext';
import { router } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <AuditProvider>
        <UsersProvider>
          <RouterProvider router={router} />
        </UsersProvider>
      </AuditProvider>
    </AuthProvider>
  );
}