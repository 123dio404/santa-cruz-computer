const API_BASE_URL = 'http://localhost:8000/api/v1';

// ── Token store ──────────────────────────────────────────────────────────────
const TOKEN_KEY = 'access_token';

export const setAuthToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearAuthToken = () => localStorage.removeItem(TOKEN_KEY);

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

/** Headers de autorización para peticiones de escritura */
const authHeaders = (): Record<string, string> => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Response helpers ─────────────────────────────────────────────────────────
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
    throw new Error(err.error || err.detail || `HTTP ${response.status}`);
  }
  return response.json();
};

// ============ AUTH ============
export const authAPI = {
  login: async (username: string, password?: string): Promise<any> => {
    const body: Record<string, string> = { username };
    if (password) body.password = password;
    const response = await fetch(`${API_BASE_URL}/users/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await handleJson(response);
    if (data?.access) setAuthToken(data.access);
    return data;
  },

  forgotPassword: async (identifier: string): Promise<{ message: string }> => {
    const r = await fetch(`${API_BASE_URL}/users/forgot-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    return handleJson(r);
  },

  resetPassword: async (identifier: string, code: string, new_password: string): Promise<{ message: string }> => {
    const r = await fetch(`${API_BASE_URL}/users/reset-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, new_password }),
    });
    return handleJson(r);
  },
};

// ============ TYPES ============
export interface ApiUser {
  id: number;
  username: string | null;
  name: string;
  email: string;
  telefono: string | null;
  fecha_nacimiento: string | null;
  ciudad: string | null;
  role: 'admin' | 'vendedor' | 'cliente';
  activo: boolean;
  created_at: string;
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
  imagen_url: string | null;
  categoria: number | null;
  categoria_nombre: string | null;
  is_low_stock: boolean;
  created_at: string;
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
  detalles?: ApiDetalleVenta[];
  pagos?: ApiPago[];
}

export interface ApiDetalleVenta {
  id: number;
  venta: number;
  producto: number;
  producto_name?: string;
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

// ============ USUARIOS ============
const USERS_URL = `${API_BASE_URL}/users`;

export const usuariosAPI = {
  getAll: async (): Promise<ApiUser[]> => {
    const r = await fetch(`${USERS_URL}/?page_size=1000`);
    return handlePaginated(r);
  },
  getById: async (id: number): Promise<ApiUser> => {
    const r = await fetch(`${USERS_URL}/${id}/`);
    return handleJson(r);
  },
  getByRole: async (role: string): Promise<ApiUser[]> => {
    const r = await fetch(`${USERS_URL}/by_role/?role=${role}`);
    return handlePaginated(r);
  },
  create: async (data: Partial<ApiUser>): Promise<ApiUser> => {
    const r = await fetch(`${USERS_URL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  update: async (id: number, data: Partial<ApiUser>): Promise<ApiUser> => {
    const r = await fetch(`${USERS_URL}/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  updateRole: async (id: number, role: string): Promise<ApiUser> => {
    const r = await fetch(`${USERS_URL}/${id}/update_role/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await fetch(`${USERS_URL}/${id}/`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// ============ CATEGORÍAS ============
export const categoriasAPI = {
  getAll: async (): Promise<ApiCategoria[]> => {
    const r = await fetch(`${API_BASE_URL}/products/categorias/?page_size=1000`);
    return handlePaginated(r);
  },
  create: async (nombre: string): Promise<ApiCategoria> => {
    const r = await fetch(`${API_BASE_URL}/products/categorias/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ nombre }),
    });
    return handleJson(r);
  },
  update: async (id: number, nombre: string): Promise<ApiCategoria> => {
    const r = await fetch(`${API_BASE_URL}/products/categorias/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ nombre }),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/products/categorias/${id}/`, {
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
    const r = await fetch(`${API_BASE_URL}/products/?page_size=1000`);
    return handlePaginated(r);
  },
  getById: async (id: number): Promise<ApiProduct> => {
    const r = await fetch(`${API_BASE_URL}/products/${id}/`);
    return handleJson(r);
  },
  getLowStock: async (): Promise<ApiProduct[]> => {
    const r = await fetch(`${API_BASE_URL}/products/low_stock/`);
    return handlePaginated(r);
  },
  create: async (data: Record<string, any>, imageFile?: File | null): Promise<ApiProduct> => {
    const { body, headers } = buildProductBody(data, imageFile);
    const r = await fetch(`${API_BASE_URL}/products/`, { method: 'POST', headers, body });
    return handleJson(r);
  },
  update: async (id: number, data: Record<string, any>, imageFile?: File | null): Promise<ApiProduct> => {
    const { body, headers } = buildProductBody(data, imageFile);
    const r = await fetch(`${API_BASE_URL}/products/${id}/`, { method: 'PATCH', headers, body });
    return handleJson(r);
  },
  adjustStock: async (id: number, newStock: number): Promise<ApiProduct> => {
    const r = await fetch(`${API_BASE_URL}/products/${id}/adjust_stock/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ stock: newStock }),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/products/${id}/`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
    const r = await fetch(`${API_BASE_URL}/audit/`, { headers: authHeaders() });
    return handlePaginated(r);
  },
};

// ============ VENTAS ============
export const ventasAPI = {
  getAll: async (): Promise<ApiVenta[]> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/?page_size=1000`);
    return handlePaginated(r);
  },
  getById: async (id: number): Promise<ApiVenta> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/${id}/`);
    return handleJson(r);
  },
  getByCliente: async (clienteId: number): Promise<ApiVenta[]> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/?cliente=${clienteId}&page_size=1000`);
    return handlePaginated(r);
  },
  getByVendedor: async (vendedorId: number): Promise<ApiVenta[]> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/by_vendedor/?vendedor_id=${vendedorId}`);
    return handlePaginated(r);
  },
  getHistorialByVendedor: async (vendedorId: number): Promise<any> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/historial/?vendedor_id=${vendedorId}`);
    return handleJson(r);
  },
  create: async (data: any): Promise<ApiVenta> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  update: async (id: number, data: Partial<ApiVenta>): Promise<ApiVenta> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleJson(r);
  },
  delete: async (id: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/orders/ventas/${id}/`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  },
};

// ============ DETALLES ============
export const detallesVentaAPI = {
  getAll: async (): Promise<ApiDetalleVenta[]> => {
    const r = await fetch(`${API_BASE_URL}/orders/detalles/?page_size=1000`);
    return handlePaginated(r);
  },
  getByVenta: async (ventaId: number): Promise<ApiDetalleVenta[]> => {
    const r = await fetch(`${API_BASE_URL}/orders/detalles/?venta=${ventaId}&page_size=1000`);
    return handlePaginated(r);
  },
};

// ============ PAGOS ============
export const pagosAPI = {
  getAll: async (): Promise<ApiPago[]> => {
    const r = await fetch(`${API_BASE_URL}/orders/pagos/?page_size=1000`);
    return handlePaginated(r);
  },
  getByVenta: async (ventaId: number): Promise<ApiPago[]> => {
    const r = await fetch(`${API_BASE_URL}/orders/pagos/?venta=${ventaId}&page_size=1000`);
    return handlePaginated(r);
  },
};
