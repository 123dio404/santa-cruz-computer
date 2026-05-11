/**
 * BackendTestComponent.tsx - Componente de prueba para verificar conexión
 * 
 * Este componente prueba todos los endpoints principales del backend
 * Se puede usar para verificar que la integración funciona correctamente
 */

import { useEffect, useState } from 'react';
import { usuariosAPI, productosAPI, ventasAPI, authAPI, ApiUser, ApiProduct, ApiVenta } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from 'lucide-react';

export function BackendTestComponent() {
  const [usuarios, setUsuarios] = useState<ApiUser[]>([]);
  const [productos, setProductos] = useState<ApiProduct[]>([]);
  const [ventas, setVentas] = useState<ApiVenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginUser, setLoginUser] = useState<ApiUser | null>(null);

  // Cargar usuarios
  const cargarUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usuariosAPI.getAll();
      setUsuarios(data);
    } catch (err) {
      setError('Error cargando usuarios: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // Cargar productos
  const cargarProductos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productosAPI.getAll();
      setProductos(data);
    } catch (err) {
      setError('Error cargando productos: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // Cargar ventas
  const cargarVentas = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ventasAPI.getAll();
      setVentas(data);
    } catch (err) {
      setError('Error cargando ventas: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // Login de prueba
  const hacerLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authAPI.login('admin@mail.com');
      setLoginUser(response.user);
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('user', JSON.stringify(response.user));
    } catch (err) {
      setError('Error en login: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // Cargar todo al montar
  useEffect(() => {
    cargarUsuarios();
    cargarProductos();
    cargarVentas();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">🔗 Prueba de Integración Backend-Frontend</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Login Test */}
      <Card>
        <CardHeader>
          <CardTitle>Autenticación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={hacerLogin}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin mr-2" />
                  Probando Login...
                </>
              ) : (
                'Probar Login (admin@mail.com)'
              )}
            </Button>
            
            {loginUser && (
              <div className="bg-green-100 border border-green-400 text-green-700 p-3 rounded">
                ✅ Login exitoso: {loginUser.name} ({loginUser.role})
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usuarios */}
      <Card>
        <CardHeader>
          <CardTitle>
            Usuarios ({usuarios.length})
            <Button
              onClick={cargarUsuarios}
              disabled={loading}
              variant="outline"
              className="float-right"
              size="sm"
            >
              {loading ? <Loader className="animate-spin" /> : 'Recargar'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usuarios.length === 0 ? (
            <p className="text-gray-500">No hay usuarios</p>
          ) : (
            <div className="space-y-2">
              {usuarios.map((user) => (
                <div key={user.id} className="bg-gray-100 p-3 rounded">
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-gray-600">Email: {user.email}</p>
                  <p className="text-sm text-gray-600">Rol: {user.role}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Productos */}
      <Card>
        <CardHeader>
          <CardTitle>
            Productos ({productos.length})
            <Button
              onClick={cargarProductos}
              disabled={loading}
              variant="outline"
              className="float-right"
              size="sm"
            >
              {loading ? <Loader className="animate-spin" /> : 'Recargar'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productos.length === 0 ? (
            <p className="text-gray-500">No hay productos</p>
          ) : (
            <div className="space-y-2">
              {productos.map((product) => (
                <div key={product.id} className="bg-gray-100 p-3 rounded">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-gray-600">Precio: ${product.price}</p>
                  <p className={`text-sm ${product.stock <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                    Stock: {product.stock}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ventas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Ventas ({ventas.length})
            <Button
              onClick={cargarVentas}
              disabled={loading}
              variant="outline"
              className="float-right"
              size="sm"
            >
              {loading ? <Loader className="animate-spin" /> : 'Recargar'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ventas.length === 0 ? (
            <p className="text-gray-500">No hay ventas registradas. Crea una nueva venta en el backend.</p>
          ) : (
            <div className="space-y-2">
              {ventas.map((venta) => (
                <div key={venta.id} className="bg-gray-100 p-3 rounded">
                  <p className="font-semibold">Venta #{venta.id}</p>
                  <p className="text-sm text-gray-600">Total: ${venta.total}</p>
                  <p className="text-sm text-gray-600">Estado: {venta.status}</p>
                  <p className="text-sm text-gray-600">Fecha: {new Date(venta.fecha).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info de Conexión */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>ℹ️ Info de Conexión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>🔗 Backend: http://localhost:8000</p>
          <p>🌐 Frontend: http://localhost:5174</p>
          <p>🗄️ Base de Datos: PostgreSQL (Santacruzcomputer)</p>
          <p className="text-xs text-gray-600 mt-4">
            Todos los endpoints están conectados. Prueba realizar operaciones CRUD en el backend admin para ver los cambios aquí.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
