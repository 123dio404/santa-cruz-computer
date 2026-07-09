/**
 * api.ts - Capa de Comunicación con el Backend
 *
 * Este archivo centraliza TODAS las llamadas HTTP al backend Django.
 * Cada grupo de funciones (productosAPI, ventasAPI, etc.) corresponde
 * a un módulo del backend.
 *
 * ESTRUCTURA:
 * - authAPI       → Login, logout, recuperar contraseña, cambiar contraseña
 * - clientesAPI   → CRUD de clientes (tabla cliente en BD)
 * - usuariosAPI   → CRUD de usuarios del sistema (admin, vendedores)
 * - categoriasAPI → CRUD de categorías de productos
 * - productosAPI  → CRUD de productos, ajuste de stock
 * - ventasAPI     → Crear y consultar ventas
 * - detallesVentaAPI → Ítems individuales de cada venta
 * - comprasAPI    → Registrar y consultar compras a proveedores
 * - proveedoresAPI → CRUD de proveedores
 * - bitacoraAPI   → Consulta de la bitácora de auditoría
 * - notificacionesAPI → Notificaciones (stock bajo, pedidos pendientes)
 *
 * AUTENTICACIÓN:
 * El token JWT se guarda en localStorage con la clave 'access_token'.
 * Las funciones authHeaders() agregan el header Authorization: Bearer <token>
 * automáticamente a las peticiones que lo requieren.
 */

// URL base del backend (usa variable de entorno en producción, localhost en desarrollo)
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
// URL raíz del backend (sin /api/v1) para servir archivos estáticos como imágenes
export const BACKEND_ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

// ── Manejo del Token JWT ──────────────────────────────────────────────────────
const TOKEN_KEY = 'access_token';

// Guarda el token en localStorage después del login
export const setAuthToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
// Elimina el token del localStorage al hacer logout
export const clearAuthToken = () => localStorage.removeItem(TOKEN_KEY);

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

// Genera los headers de autorización para peticiones protegidas
const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Wrapper de fetch: token automático + manejo de 401 ────────────────────────
// Inyecta el header Authorization en TODAS las llamadas (aunque el sitio no lo
// haya puesto), de modo que al blindar el backend ninguna lectura quede sin token.
// Si el backend responde 401 (token ausente / inválido / expirado) limpiamos la
// sesión y mandamos al login. Se excluye /users/login (un 401 ahí = credencial mala,
// no sesión expirada). El 403 (rol sin permiso) NO cierra sesión: solo falla la acción.
let sessionExpiredHandled = false;
const apiFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const token = getToken();
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const res = await window.fetch(url, { ...init, headers });
  if (res.status === 401 && token && !url.includes('/users/login')) {
    if (!sessionExpiredHandled) {
      sessionExpiredHandled = true;
      clearAuthToken();
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    }
  }
  return res;
};

// ── Helpers de Respuesta HTTP ─────────────────────────────────────────────────

// handlePaginated: para listas paginadas del backend (devuelve el array de resultados)
// Soporta tanto listas planas como objetos { results: [...] } (paginación de DRF)
const handlePaginated = async (response: Response) => {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : (data.results ?? []);
};

const handleJson = async (response: Response) => {
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // DRF validation errors: { field: ["msg"] } — aplanar a string legible
    if (!err.error && !err.detail) {
      const msgs = Object.entries(err)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join(' | ');
      throw new Error(msgs || `HTTP ${response.status}`);
    }
    throw new Error(err.error || err.detail || `HTTP ${response.status}`);
  }
  return response.json();
};

// ============ AUTH ============
export const authAPI = {
  login: async (username: string, password?: string): Promise<any> => {
    const body: Record<string, string> = { username };
    if (password) body.password = password;
    const response = await apiFetch(`${API_BASE_URL}/users/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await handleJson(response);
    if (data?.access) setAuthToken(data.access);
    return data;
  },

  forgotPassword: async (identifier: string): Promise<{ message: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/users/forgot-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    return handleJson(r);
  },

  resetPassword: async (identifier: string, code: string, new_password: string): Promise<{ message: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/users/reset-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, new_password }),
    });
    return handleJson(r);
  },

  checkEmail: async (email: string): Promise<{ available: boolean }> => {
    const r = await apiFetch(`${API_BASE_URL}/users/check-email/?email=${encodeURIComponent(email)}`);
    return handleJson(r);
  },

  logout: async (userData?: { usuario_id: number; usuario_nombre: string; usuario_rol: string }): Promise<void> => {
    const token = localStorage.getItem('access_token');
    await apiFetch(`${API_BASE_URL}/users/logout/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(userData ?? {}),
    }).catch(() => {});
  },

  blockedAccounts: async (): Promise<{ username: string; failed_attempts: number; estado: string }[]> => {
    const r = await apiFetch(`${API_BASE_URL}/users/blocked-accounts/`, {
      headers: authHeaders(),
    });
    return handleJson(r);
  },

  unblockAccount: async (username: string): Promise<{ message: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/users/unblock-account/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ username }),
    });
    return handleJson(r);
  },

  changePassword: async (current_password: string, new_password: string): Promise<{ message: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/users/change-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ current_password, new_password }),
    });
    return handleJson(r);
  },
};

// ============ TYPES ============
export interface ApiUser {
  id: number;
  username: string;
  nombre_completo: string;
  rol: string;
  activo: boolean;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  fecha_nacimiento: string | null;
  // compat aliases devueltos por el serializer
  name: string;
  role: string;
}

export interface ApiCategoria {
  id: number;
  nombre: string;
}

export interface ApiProduct {
  id: number;
  name: string;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  price: number;
  precio_compra: number | null;
  precio_venta: number | null;
  stock: number | null;
  stock_minimo: number;
  estado: string | null;
  descripcion: string | null;
  meses_garantia: number;
  imagen_url: string | null;
  categoria: number | null;
  categoria_nombre: string | null;
  is_low_stock: boolean;
  created_at: string;
  promo_porcentaje: number | null;    // CU24: % de descuento si hay promo vigente
  precio_promocional: number | null;  // CU24: precio ya con el descuento
}

export interface ApiVenta {
  id: number;
  cliente: number | null;
  cliente_name: string | null;
  vendedor: number | null;
  vendedor_name: string | null;
  total: number;
  status: string;
  fecha: string;
  descuento_aplicado?: number;
  detalles?: ApiDetalleVenta[];
  pagos?: ApiPago[];
  es_credito?: boolean;               // CU28/CU29 — true si la venta tiene un plan de crédito asociado
  credito_plan_id?: number | null;
}

export interface ApiDetalleVenta {
  id: number;
  venta: number;
  producto: number;
  producto_name?: string;
  producto_imagen?: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface ApiPago {
  id: number;
  venta: number;
  monto: number;
  metodo: string;
  fecha: string;
}

export interface ApiGarantia {
  id: number;
  venta: number;
  detalle: number;
  producto: number;
  producto_nombre: string;
  producto_imagen: string | null;
  cliente: number | null;
  cliente_nombre: string | null;
  cantidad: number;
  meses: number;
  fecha_inicio: string;   // YYYY-MM-DD
  fecha_fin: string;      // YYYY-MM-DD
  estado: 'activa' | 'reclamada' | 'aprobada' | 'rechazada';
  // calculado por el backend: vigente | vencida | reclamada | aprobada | rechazada
  estado_efectivo: 'vigente' | 'vencida' | 'reclamada' | 'aprobada' | 'rechazada';
  vigente: boolean;       // true → se puede reclamar
  dias_restantes: number;
  motivo_reclamo: string | null;
  fecha_reclamo: string | null;
  resolucion: string | null;
  fecha_resolucion: string | null;
  venta_estado: string;   // 'pending' | 'completed'
}

export interface ApiResena {
  id: number;
  venta: number;
  cliente: number;
  cliente_nombre: string;   // "Juan P."
  puntuacion: number;       // 1-5
  comentario: string | null;
  estado: 'visible' | 'oculto';
  fecha: string;
}

export interface ResenasPublicas {
  promedio: number;
  total: number;
  resenas: ApiResena[];
}

export interface ApiCliente {
  id: number;
  nombre: string;
  apellido: string;
  usuario_login: string | null;
  correo: string | null;
  sexo: string | null;
  ciudad: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  nit_ci: string | null;
  razon_social: string | null;
  total_acumulado?: number;
  descuento_disponible?: number;
  es_vip?: boolean;
}

// ============ CLIENTES ============
export const clientesAPI = {
  getAll: async (): Promise<ApiCliente[]> => {
    const r = await apiFetch(`${API_BASE_URL}/users/clientes/?page_size=1000`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  getById: async (id: number): Promise<ApiCliente> => {
    const r = await apiFetch(`${API_BASE_URL}/users/clientes/${id}/`, { headers: authHeaders() });
    return handleJson(r);
  },
  create: async (data: Partial<ApiCliente>): Promise<ApiCliente> => {
    const r = await apiFetch(`${API_BASE_URL}/users/clientes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  update: async (id: number, data: Partial<ApiCliente>): Promise<ApiCliente> => {
    const r = await apiFetch(`${API_BASE_URL}/users/clientes/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await apiFetch(`${API_BASE_URL}/users/clientes/${id}/`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// ============ USUARIOS ============
const USERS_URL = `${API_BASE_URL}/users`;

export const usuariosAPI = {
  getAll: async (): Promise<ApiUser[]> => {
    const r = await apiFetch(`${USERS_URL}/?page_size=1000`);
    return handlePaginated(r);
  },
  getById: async (id: number): Promise<ApiUser> => {
    const r = await apiFetch(`${USERS_URL}/${id}/`);
    return handleJson(r);
  },
  getByRole: async (role: string): Promise<ApiUser[]> => {
    const r = await apiFetch(`${USERS_URL}/by_role/?role=${role}`);
    return handlePaginated(r);
  },
  create: async (data: Partial<ApiUser>): Promise<ApiUser> => {
    const r = await apiFetch(`${USERS_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  update: async (id: number, data: Partial<ApiUser>): Promise<ApiUser> => {
    const r = await apiFetch(`${USERS_URL}/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  updateRole: async (id: number, role: string): Promise<ApiUser> => {
    const r = await apiFetch(`${USERS_URL}/${id}/update_role/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await apiFetch(`${USERS_URL}/${id}/`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// ============ CATEGORÍAS ============
export const categoriasAPI = {
  getAll: async (): Promise<ApiCategoria[]> => {
    const r = await apiFetch(`${API_BASE_URL}/products/categorias/?page_size=1000`);
    return handlePaginated(r);
  },
  create: async (nombre: string): Promise<ApiCategoria> => {
    const r = await apiFetch(`${API_BASE_URL}/products/categorias/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ nombre }),
    });
    return handleJson(r);
  },
  update: async (id: number, nombre: string): Promise<ApiCategoria> => {
    const r = await apiFetch(`${API_BASE_URL}/products/categorias/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ nombre }),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await apiFetch(`${API_BASE_URL}/products/categorias/${id}/`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// Construye el body correcto: FormData si hay imagen, JSON si no
const buildProductBody = (
  data: Record<string, any>,
  imageFile?: File | null,
): { body: FormData | string; headers: Record<string, string> } => {
  if (imageFile) {
    const fd = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') fd.append(k, String(v));
    });
    fd.append('imagen_url', imageFile);
    // browser pone el Content-Type con boundary; solo inyectamos Authorization
    return { body: fd, headers: authHeaders() };
  }
  return {
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  };
};

// ============ PRODUCTOS ============
export const productosAPI = {
  getAll: async (): Promise<ApiProduct[]> => {
    const r = await apiFetch(`${API_BASE_URL}/products/?page_size=1000`);
    return handlePaginated(r);
  },
  getById: async (id: number): Promise<ApiProduct> => {
    const r = await apiFetch(`${API_BASE_URL}/products/${id}/`);
    return handleJson(r);
  },
  getLowStock: async (): Promise<ApiProduct[]> => {
    const r = await apiFetch(`${API_BASE_URL}/products/low_stock/`);
    return handlePaginated(r);
  },
  create: async (data: Record<string, any>, imageFile?: File | null): Promise<ApiProduct> => {
    const { body, headers } = buildProductBody(data, imageFile);
    const r = await apiFetch(`${API_BASE_URL}/products/`, { method: 'POST', headers, body });
    return handleJson(r);
  },
  update: async (id: number, data: Record<string, any>, imageFile?: File | null): Promise<ApiProduct> => {
    const { body, headers } = buildProductBody(data, imageFile);
    const r = await apiFetch(`${API_BASE_URL}/products/${id}/`, { method: 'PATCH', headers, body });
    return handleJson(r);
  },
  adjustStock: async (id: number, newStock: number): Promise<ApiProduct> => {
    const r = await apiFetch(`${API_BASE_URL}/products/${id}/adjust_stock/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ stock: newStock }),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await apiFetch(`${API_BASE_URL}/products/${id}/`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || err.detail || `HTTP ${r.status}`);
    }
  },
};

export interface ApiBitacora {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string;
  usuario_rol: string;
  accion: string;
  accion_display: string;
  modulo: string;
  descripcion: string;
  ip_address: string | null;
  fecha: string;
}

// ============ BITÁCORA ============
export const bitacoraAPI = {
  getAll: async (): Promise<ApiBitacora[]> => {
    const r = await apiFetch(`${API_BASE_URL}/audit/`, { headers: authHeaders() });
    return handlePaginated(r);
  },
};

// ============ VENTAS ============
export const ventasAPI = {
  getAll: async (): Promise<ApiVenta[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/?page_size=1000`);
    return handlePaginated(r);
  },
  getById: async (id: number): Promise<ApiVenta> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/${id}/`);
    return handleJson(r);
  },
  getByCliente: async (clienteId: number): Promise<ApiVenta[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/?cliente=${clienteId}&page_size=1000`);
    return handlePaginated(r);
  },
  getByVendedor: async (vendedorId: number): Promise<ApiVenta[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/by_vendedor/?vendedor_id=${vendedorId}`);
    return handlePaginated(r);
  },
  getHistorialByVendedor: async (vendedorId: number): Promise<any> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/historial/?vendedor_id=${vendedorId}`);
    return handleJson(r);
  },
  create: async (data: any): Promise<ApiVenta> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  update: async (id: number, data: Partial<ApiVenta>): Promise<ApiVenta> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  confirmarEntrega: async (id: number): Promise<ApiVenta> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/${id}/confirmar_entrega/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ventas/${id}/`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// ============ STRIPE (pago con tarjeta) ============
export const stripeAPI = {
  // Crea la sesión de pago en Stripe y devuelve la URL hospedada. NO crea la venta aún.
  createCheckoutSession: async (data: {
    cliente: number;
    detalles: { producto: number; cantidad: number; precio_unitario: number }[];
    monto: number;
    aplicar_descuento_vip: boolean;
  }): Promise<{ url: string; session_id: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/stripe/create-checkout-session/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  // Confirma el pago al volver de Stripe; el backend verifica y crea la venta (pending).
  confirm: async (sessionId: string): Promise<ApiVenta> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/stripe/confirm/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ session_id: sessionId }),
    });
    return handleJson(r);
  },
};

// ============ GARANTÍAS ============
export const garantiasAPI = {
  // Garantías de un cliente (para "Mis Pedidos")
  getByCliente: async (clienteId: number): Promise<ApiGarantia[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/garantias/?cliente=${clienteId}&page_size=1000`);
    return handlePaginated(r);
  },
  // Todas las garantías (panel interno). Opcionalmente filtra por estado.
  getAll: async (estado?: string): Promise<ApiGarantia[]> => {
    const q = estado ? `&estado=${estado}` : '';
    const r = await apiFetch(`${API_BASE_URL}/orders/garantias/?page_size=1000${q}`);
    return handlePaginated(r);
  },
  // Cliente reporta un problema con el producto
  reclamar: async (id: number, motivo: string): Promise<ApiGarantia> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/garantias/${id}/reclamar/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ motivo }),
    });
    return handleJson(r);
  },
  // Vendedor/admin: el reclamo procede
  aprobar: async (id: number, resolucion: string): Promise<ApiGarantia> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/garantias/${id}/aprobar/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ resolucion }),
    });
    return handleJson(r);
  },
  // Vendedor/admin: el reclamo NO procede (producto manipulado/mal uso)
  rechazar: async (id: number, resolucion: string): Promise<ApiGarantia> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/garantias/${id}/rechazar/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ resolucion }),
    });
    return handleJson(r);
  },
  // Genera las garantías faltantes de ventas anteriores
  generarRetroactivas: async (): Promise<{ creadas: number }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/garantias/generar-retroactivas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    return handleJson(r);
  },
};

// ============ RESEÑAS ============
export const resenasAPI = {
  // Reseñas de un cliente (para saber qué pedidos ya calificó en Mis Pedidos)
  getByCliente: async (clienteId: number): Promise<ApiResena[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/resenas/?cliente=${clienteId}&page_size=1000`);
    return handlePaginated(r);
  },
  // Todas las reseñas incl. ocultas (moderación admin)
  getAll: async (): Promise<ApiResena[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/resenas/?page_size=1000`);
    return handlePaginated(r);
  },
  // Resumen público para la Tienda: promedio + total + lista visible
  getPublicas: async (): Promise<ResenasPublicas> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/resenas/publicas/`);
    return handleJson(r);
  },
  // Cliente califica una venta completada (1 por venta)
  create: async (data: { cliente: number; venta: number; puntuacion: number; comentario?: string }): Promise<ApiResena> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/resenas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  // Admin: ocultar / mostrar (moderación)
  ocultar: async (id: number): Promise<ApiResena> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/resenas/${id}/ocultar/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    return handleJson(r);
  },
  mostrar: async (id: number): Promise<ApiResena> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/resenas/${id}/mostrar/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    return handleJson(r);
  },
};

// ============ VOZ (interpretación de comandos con Gemini) ============
export type VozReporte =
  | 'almacen' | 'entradas' | 'salidas' | 'ventas' | 'compras'
  | 'top_vendidos' | 'top_comprados' | 'top_clientes' | 'top_proveedores'
  // Etapa 3 — facturas/historiales puntuales
  | 'factura'            // descarga la factura PDF de UNA venta por su número
  | 'facturas_cliente'   // historial de ventas de un cliente concreto
  | 'compras_proveedor'; // historial de compras a un proveedor concreto
export type VozFormato = 'excel' | 'pdf' | 'ambos';
export interface VozIntencion {
  reporte: VozReporte | null;
  formato: VozFormato;
  desde?: string | null;          // AAAA-MM-DD (inicio del periodo) o null
  hasta?: string | null;          // AAAA-MM-DD (fin del periodo) o null
  numero_venta?: number | null;   // para 'factura' (número de la venta)
  cliente_nombre?: string | null; // para 'facturas_cliente' (nombre dictado)
  proveedor_nombre?: string | null; // para 'compras_proveedor' (nombre dictado)
}
export const vozAPI = {
  // Respaldo: si las reglas del frontend no entienden el comando, Gemini lo interpreta
  interpretar: async (texto: string): Promise<VozIntencion> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/voz-intencion/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ texto }),
    });
    return handleJson(r);
  },
};

// ============ DETALLES ============
export const detallesVentaAPI = {
  getAll: async (): Promise<ApiDetalleVenta[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/detalles/?page_size=1000`);
    return handlePaginated(r);
  },
  getByVenta: async (ventaId: number): Promise<ApiDetalleVenta[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/detalles/?venta=${ventaId}&page_size=1000`);
    return handlePaginated(r);
  },
};

// ============ PAGOS ============
export const pagosAPI = {
  getAll: async (): Promise<ApiPago[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/pagos/?page_size=1000`);
    return handlePaginated(r);
  },
  getByVenta: async (ventaId: number): Promise<ApiPago[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/pagos/?venta=${ventaId}&page_size=1000`);
    return handlePaginated(r);
  },
};

// ============ PROVEEDORES ============
export interface ApiProveedor {
  id: number;
  nombre_empresa: string;
  nit: string;
  razon_social: string | null;
  contacto_nombre: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  ciudad: string | null;
  activo: boolean;
  fecha_registro: string;
}

export interface ApiDetalleCompra {
  id: number;
  producto: number;
  producto_nombre: string;
  producto_modelo: string | null;
  cantidad: number;
  costo_unitario: number;
}

export interface ApiCompra {
  id: number;
  proveedor: number;
  proveedor_nombre: string;
  fecha_compra: string;
  monto_total: number;
  detalles: ApiDetalleCompra[];
}

export const proveedoresAPI = {
  getAll: async (): Promise<ApiProveedor[]> => {
    const r = await apiFetch(`${API_BASE_URL}/products/proveedores/?page_size=1000`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  create: async (data: Partial<ApiProveedor>): Promise<ApiProveedor> => {
    const r = await apiFetch(`${API_BASE_URL}/products/proveedores/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  update: async (id: number, data: Partial<ApiProveedor>): Promise<ApiProveedor> => {
    const r = await apiFetch(`${API_BASE_URL}/products/proveedores/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await apiFetch(`${API_BASE_URL}/products/proveedores/${id}/`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// ============ COMPRAS ============
export const comprasAPI = {
  getAll: async (): Promise<ApiCompra[]> => {
    const r = await apiFetch(`${API_BASE_URL}/products/compras/?page_size=1000`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  create: async (data: {
    proveedor: number;
    detalles: { producto: number; cantidad: number; costo_unitario: number }[];
  }): Promise<ApiCompra> => {
    const r = await apiFetch(`${API_BASE_URL}/products/compras/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
};

// ── Notificaciones (CU21) ─────────────────────────────────────────────────────
export interface ApiNotificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  canal: string;
  leido: boolean;
  fecha: string;
}

// ── Servicio Técnico (CU25/26/27) ─────────────────────────────────────────────
export interface ApiServicioCatalogo {
  id: number; nombre: string; tipo: string; equipo: string | null; precio: number; activo: boolean;
}
export interface ApiOrdenServicio {
  id: number;
  cliente: number | null;
  cliente_nombre: string;
  tecnico: number | null;
  tecnico_nombre: string;
  garantia: number | null;
  tipo: string;
  origen: string;
  equipo: string;
  equipo_descripcion: string | null;
  es_beneficio: boolean;
  diagnostico: string | null;
  observaciones: string | null;
  costo_total: number;
  estado: string;
  fecha_solicitud: string;
  fecha_agendada: string | null;
  fecha_finalizacion: string | null;
  fecha_entrega_prevista: string | null;
  fecha_entrega_real: string | null;
  detalles: { id: number; servicio: number; servicio_nombre: string; precio: number }[];
  tareas: { id: number; tarea: string; realizado: boolean }[];
}
export interface ApiElegibilidad {
  garantia_id: number; producto: string; fecha_fin: string; usos_disponibles: number;
}

export const servicioTecnicoAPI = {
  catalogo: async (): Promise<ApiServicioCatalogo[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/servicios-catalogo/`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  ordenes: async (params?: { tecnico?: number; cliente?: number; estado?: string }): Promise<ApiOrdenServicio[]> => {
    const q = new URLSearchParams();
    if (params?.tecnico) q.set('tecnico', String(params.tecnico));
    if (params?.cliente) q.set('cliente', String(params.cliente));
    if (params?.estado)  q.set('estado', params.estado);
    q.set('page_size', '1000');
    const r = await apiFetch(`${API_BASE_URL}/orders/ordenes-servicio/?${q.toString()}`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  elegibilidad: async (clienteId: number): Promise<ApiElegibilidad[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ordenes-servicio/elegibilidad/?cliente=${clienteId}`, { headers: authHeaders() });
    if (!r.ok) return [];
    return r.json();
  },
  crear: async (data: any): Promise<ApiOrdenServicio> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ordenes-servicio/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  cambiarEstado: async (id: number, data: any): Promise<ApiOrdenServicio> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ordenes-servicio/${id}/estado/`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  agendar: async (id: number, fecha_entrega_prevista: string): Promise<ApiOrdenServicio> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ordenes-servicio/${id}/agendar/`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ fecha_entrega_prevista }),
    });
    return handleJson(r);
  },
  entregar: async (id: number): Promise<ApiOrdenServicio> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ordenes-servicio/${id}/entregar/`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: '{}',
    });
    return handleJson(r);
  },
  checklist: async (id: number, tareas: { id: number; realizado: boolean }[]): Promise<ApiOrdenServicio> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/ordenes-servicio/${id}/checklist/`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ tareas }),
    });
    return handleJson(r);
  },
};

// ── Promociones (CU24) ────────────────────────────────────────────────────────
export interface ApiPromocion {
  id: number;
  producto: number;
  producto_nombre: string;
  porcentaje: number;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  precio_normal: number;
  precio_promocional: number;
  vigente: boolean;
}

export const promocionesAPI = {
  getAll: async (): Promise<ApiPromocion[]> => {
    const r = await apiFetch(`${API_BASE_URL}/products/promociones/`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  create: async (data: {
    producto: number; porcentaje: number; fecha_inicio: string; fecha_fin: string; activo?: boolean;
  }): Promise<ApiPromocion> => {
    const r = await apiFetch(`${API_BASE_URL}/products/promociones/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  remove: async (id: number): Promise<void> => {
    await apiFetch(`${API_BASE_URL}/products/promociones/${id}/`, { method: 'DELETE', headers: authHeaders() });
  },
  // CU24: envía las ofertas vigentes a todos los clientes (correo + campana)
  enviarOfertas: async (): Promise<{ enviados: number; promociones: number }> => {
    const r = await apiFetch(`${API_BASE_URL}/products/promociones/enviar-ofertas/`, {
      method: 'POST', headers: authHeaders(),
    });
    return handleJson(r);
  },
};

// ── Devoluciones (CU23) ───────────────────────────────────────────────────────
export const devolucionesAPI = {
  list: async (ventaId?: number): Promise<any[]> => {
    const q = ventaId ? `?venta=${ventaId}` : '';
    const r = await apiFetch(`${API_BASE_URL}/orders/devoluciones/${q}`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  getByCliente: async (clienteId: number): Promise<any[]> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/devoluciones/?cliente=${clienteId}`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  crear: async (data: {
    detalle: number; cantidad: number; motivo: string;
    aprobar: boolean; motivo_rechazo?: string;
    insp_sin_dano?: boolean; insp_sin_manipulacion?: boolean;
    insp_mismo_producto?: boolean; insp_completo?: boolean;
  }): Promise<any> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/devoluciones/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
};

// ── Venta a crédito / Cartera (CU28/CU29) ─────────────────────────────────────
export interface ApiCuota {
  id: number;
  numero: number;
  monto: number;
  mora: number;
  total: number;
  fecha_vencimiento: string;
  fecha_pago: string | null;
  estado: string;            // pendiente | pagada | vencida
  vencida: boolean;
  metodo_pago: string | null;         // efectivo | stripe | null
  numero_factura: string | null;      // FCR-YYYY-NNNNNN
  stripe_payment_intent_id: string | null;
  stripe_session_pending: string | null;
}
export interface ApiChecklistCredito {
  id: number;
  tipo_empleo: string;
  antiguedad_meses: number;
  ci_solicitante: boolean;
  ci_conyuge: boolean;
  factura_servicios: boolean;
  boletas_pago: boolean;
  extracto_gestora: boolean;
  facturas_ultimo_ano: boolean;
  estados_financieros: boolean;
  nit: boolean;
  croquis_domicilio: boolean;
  croquis_negocio: boolean;
  respaldos_patrimoniales: boolean;
  observaciones: string | null;
  fecha_verificacion: string;
}
export interface ApiPlanCredito {
  id: number;
  venta: number;
  detalle: number;
  producto: number;
  producto_nombre: string;
  cliente: number | null;
  cliente_nombre: string;
  usuario: number | null;
  precio_unitario: number;
  cantidad: number;
  precio_base: number;
  recargo_pct: number;
  precio_financiado: number;
  inicial: number;
  n_cuotas: number;
  monto_cuota: number;
  saldo: number;
  estado: string;            // vigente | pagado | moroso
  origen: string | null;             // walk_in | al_credito_sales
  numero_factura: string | null;     // FCR-YYYY-NNNNNN de la inicial
  fecha: string;
  cuotas: ApiCuota[];
  checklist: ApiChecklistCredito | null;
  cuotas_pagadas: number;
  total_pagado: number;
  proxima_cuota: string | null;
}
export interface ApiSimulacionCredito {
  elegible: boolean;
  motivo?: string;
  precio_unitario?: string;
  cantidad?: number;
  precio_base?: string;
  recargo_pct?: string;
  precio_financiado?: string;
  inicial?: string;
  n_cuotas?: number;
  monto_cuota?: string;
  saldo?: string;
}
export interface ApiCartera {
  resumen: {
    total_financiado: string;
    total_cobrado: string;
    por_cobrar: string;
    en_mora: string;
    planes_vigentes: number;
    planes_pagados: number;
    planes_morosos: number;
    clientes_bloqueados: number;
  };
  proyeccion: { mes: string; monto: string }[];
  planes: ApiPlanCredito[];
}

// Payload compartido por walk-in y desde-venta
export interface CreditoAtomicoPayload {
  cliente:          number;
  producto:         number;
  cantidad?:        number;
  tipo_empleo:      'dependiente' | 'independiente';
  antiguedad_meses: number;
  observaciones?:   string;
  checklist: {
    ci_solicitante?:          boolean;
    ci_conyuge?:              boolean;
    factura_servicios?:       boolean;
    boletas_pago?:            boolean;
    extracto_gestora?:        boolean;
    facturas_ultimo_ano?:     boolean;
    estados_financieros?:     boolean;
    nit?:                     boolean;
    croquis_domicilio?:       boolean;
    croquis_negocio?:         boolean;
    respaldos_patrimoniales?: boolean;
  };
}

export interface ApiBloqueoCredito {
  bloqueado:       boolean;
  cuotas_vencidas: number;
  activos:         number;
  limite:          number;
  motivo:          'mora' | 'limite' | 'advertencia' | null;
}

export interface ApiMisCreditosResumen {
  planes_activos:    number;
  planes_pagados:    number;
  planes_totales:    number;
  saldo_pendiente:   string;
  cuotas_pendientes: number;
  cuotas_vencidas:   number;
  proxima_cuota: null | {
    plan_id:           number;
    numero:            number;
    monto:             string;
    mora:              string;
    fecha_vencimiento: string;
    estado:            string;
  };
}

export const creditoAPI = {
  // Vista previa del plan (sin guardar) para el precio unitario y cantidad dados
  simular: async (precio: number, cantidad = 1): Promise<ApiSimulacionCredito> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/simular/?precio=${precio}&cantidad=${cantidad}`, { headers: authHeaders() });
    return handleJson(r);
  },
  // ¿El cliente está bloqueado por mora / límite de créditos activos?
  bloqueo: async (clienteId: number): Promise<ApiBloqueoCredito> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/bloqueo/?cliente=${clienteId}`, { headers: authHeaders() });
    if (!r.ok) return { bloqueado: false, cuotas_vencidas: 0, activos: 0, limite: 3, motivo: null };
    return r.json();
  },
  // Crear un plan de crédito sobre un ítem de venta ya existente (uso interno legado)
  crear: async (detalle: number): Promise<ApiPlanCredito> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ detalle }),
    });
    return handleJson(r);
  },
  // Walk-in: crédito presencial en /creditos con checklist embebido
  crearWalkIn: async (payload: CreditoAtomicoPayload): Promise<ApiPlanCredito & { advertencia: string | null }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/walk-in/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    return handleJson(r);
  },
  // "Al crédito" desde /sales — mismo body, distinto origen (backend)
  crearDesdeVenta: async (payload: CreditoAtomicoPayload): Promise<ApiPlanCredito & { advertencia: string | null }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/desde-venta/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    return handleJson(r);
  },
  // Vista del CLIENTE logueado con todos sus créditos + resumen
  misCreditos: async (): Promise<{ resumen: ApiMisCreditosResumen; planes: ApiPlanCredito[] }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/mis-creditos/`, { headers: authHeaders() });
    return handleJson(r);
  },
  planes: async (params?: { cliente?: number; estado?: string }): Promise<ApiPlanCredito[]> => {
    const q = new URLSearchParams();
    if (params?.cliente) q.set('cliente', String(params.cliente));
    if (params?.estado)  q.set('estado', params.estado);
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/?${q.toString()}`, { headers: authHeaders() });
    return handlePaginated(r);
  },
  // Registrar el pago de una cuota (efectivo, uso interno del backend)
  pagarCuota: async (cuota: number): Promise<ApiPlanCredito> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/pagar-cuota/`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cuota }),
    });
    return handleJson(r);
  },
  // Resumen de la cartera (admin, CU29)
  cartera: async (): Promise<ApiCartera> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/planes-credito/cartera/`, { headers: authHeaders() });
    return handleJson(r);
  },
  // Stripe cuota online (cliente)
  checkoutCuota: async (cuota: number): Promise<{ url: string; session_id: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/stripe/checkout-cuota/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cuota }),
    });
    return handleJson(r);
  },
  confirmarCuota: async (session_id: string): Promise<{ estado_pago: string; plan?: ApiPlanCredito; payment_status?: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/stripe/confirmar-cuota/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ session_id }),
    });
    return handleJson(r);
  },
  verificarCuotaPendiente: async (cuota: number): Promise<{ estado_pago: string; plan?: ApiPlanCredito; payment_status?: string }> => {
    const r = await apiFetch(`${API_BASE_URL}/orders/stripe/verificar-cuota-pendiente/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ cuota }),
    });
    return handleJson(r);
  },
};

export const notificacionesAPI = {
  // Devuelve mis notificaciones + el contador de no leídas
  list: async (): Promise<{ notificaciones: ApiNotificacion[]; no_leidas: number }> => {
    const r = await apiFetch(`${API_BASE_URL}/users/notificaciones/`, { headers: authHeaders() });
    if (!r.ok) return { notificaciones: [], no_leidas: 0 };
    return r.json();
  },
  // Marca una notificación ({id}) o todas ({todas:true}) como leídas
  marcarLeidas: async (payload: { id?: number; todas?: boolean }): Promise<void> => {
    await apiFetch(`${API_BASE_URL}/users/notificaciones/marcar-leidas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
  },
};
