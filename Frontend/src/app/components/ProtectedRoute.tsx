/**
 * ProtectedRoute.tsx - Guardia de Rutas Protegidas
 *
 * Este componente envuelve páginas que requieren autenticación o un rol específico.
 * Si el usuario no está logueado → lo manda al login.
 * Si está logueado pero no tiene el rol permitido → lo manda a su página de inicio.
 *
 * CÓMO FUNCIONA:
 * - allowedRoles: lista de roles que pueden acceder (ej: ['admin', 'employee'])
 * - Si no se pasa allowedRoles, cualquier usuario logueado puede entrar.
 *
 * REDIRECCIONES POR ROL:
 * - cliente sin permiso → /store
 * - admin/vendedor sin permiso → /dashboard
 */
import { Navigate } from 'react-router';
import { useAuth, UserRole } from '../context/AuthContext';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  // Si no está autenticado, redirige al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si tiene rol no permitido, redirige según su rol
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (user.role === 'client') {
      return <Navigate to="/store" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Usuario autenticado y con rol correcto → mostrar la página
  return <>{children}</>;
}
