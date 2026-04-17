export interface Product {
  id: string;
  name: string;
  description: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  category: string;
  image: string;
}

export interface Sale {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  products: { productId: string; quantity: number; price: number }[];
  total: number;
  discount: number;
  paymentMethod: 'cash' | 'card' | 'qr';
}

export interface Purchase {
  id: string;
  date: string;
  supplier: string;
  products: { productId: string; quantity: number; cost: number }[];
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  nit: string;
  totalPurchases: number;
  loyaltyPoints: number;
  registeredDate: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'increase' | 'decrease';
  quantity: number;
  reason: string;
  date: string;
  user: string;
}

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Laptop Dell XPS 15',
    description: 'Intel i7, 16GB RAM, 512GB SSD, 15.6" FHD',
    costPrice: 900,
    salePrice: 1299.99,
    stock: 15,
    minStock: 5,
    category: 'Laptops',
    image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=400&h=300&fit=crop'
  },
  {
    id: '2',
    name: 'Monitor LG UltraWide 34"',
    description: '34" IPS, 3440x1440, 144Hz, HDR',
    costPrice: 450,
    salePrice: 599.99,
    stock: 8,
    minStock: 3,
    category: 'Periféricos',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop'
  },
  {
    id: '3',
    name: 'Teclado Mecánico Logitech G Pro',
    description: 'Switch mecánico, RGB, diseño compacto',
    costPrice: 80,
    salePrice: 129.99,
    stock: 25,
    minStock: 10,
    category: 'Periféricos',
    image: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=400&h=300&fit=crop'
  },
  {
    id: '4',
    name: 'Mouse Razer DeathAdder V3',
    description: 'Sensor óptico 30K DPI, ergonómico',
    costPrice: 45,
    salePrice: 69.99,
    stock: 32,
    minStock: 15,
    category: 'Periféricos',
    image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=300&fit=crop'
  },
  {
    id: '5',
    name: 'Procesador AMD Ryzen 9 5900X',
    description: '12 núcleos, 24 hilos, 3.7GHz base',
    costPrice: 350,
    salePrice: 449.99,
    stock: 5,
    minStock: 3,
    category: 'Componentes',
    image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=400&h=300&fit=crop'
  },
  {
    id: '6',
    name: 'Tarjeta Gráfica NVIDIA RTX 4070',
    description: '12GB GDDR6X, Ray Tracing, DLSS 3',
    costPrice: 700,
    salePrice: 899.99,
    stock: 3,
    minStock: 2,
    category: 'Componentes',
    image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=400&h=300&fit=crop'
  },
  {
    id: '7',
    name: 'SSD Samsung 980 PRO 1TB',
    description: 'NVMe M.2, 7000MB/s lectura',
    costPrice: 120,
    salePrice: 159.99,
    stock: 20,
    minStock: 8,
    category: 'Almacenamiento',
    image: 'https://images.unsplash.com/photo-1617331721456-fa8c4a9a98f7?w=400&h=300&fit=crop'
  },
  {
    id: '8',
    name: 'Fuente Corsair RM850x',
    description: '850W, 80+ Gold, modular',
    costPrice: 100,
    salePrice: 139.99,
    stock: 12,
    minStock: 5,
    category: 'Componentes',
    image: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?w=400&h=300&fit=crop'
  },
  {
    id: '9',
    name: 'Audífonos HyperX Cloud II',
    description: 'Sonido surround 7.1, micrófono desmontable',
    costPrice: 60,
    salePrice: 89.99,
    stock: 18,
    minStock: 8,
    category: 'Periféricos',
    image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400&h=300&fit=crop'
  }
];

export const mockCustomers: Customer[] = [
  {
    id: 'C001',
    name: 'Carlos Mendoza',
    email: 'carlos@email.com',
    phone: '70123456',
    nit: '1234567-1A',
    totalPurchases: 3850.50,
    loyaltyPoints: 385,
    registeredDate: '2026-01-15'
  },
  {
    id: 'C002',
    name: 'Ana Torres',
    email: 'ana.torres@email.com',
    phone: '71234567',
    nit: '2345678-1B',
    totalPurchases: 1250.00,
    loyaltyPoints: 125,
    registeredDate: '2026-02-20'
  },
  {
    id: 'C003',
    name: 'Roberto Silva',
    email: 'roberto.silva@email.com',
    phone: '72345678',
    nit: '3456789-1C',
    totalPurchases: 2680.00,
    loyaltyPoints: 268,
    registeredDate: '2026-03-05'
  },
  {
    id: 'C004',
    name: 'María López',
    email: 'maria.lopez@email.com',
    phone: '73456789',
    nit: '4567890-1D',
    totalPurchases: 890.50,
    loyaltyPoints: 89,
    registeredDate: '2026-03-25'
  }
];

export const mockSuppliers: Supplier[] = [
  {
    id: 'SUP001',
    name: 'Tech Distributors SA',
    contact: 'Juan Pérez',
    phone: '2-2123456',
    email: 'ventas@techdist.com',
    address: 'Av. Arce 2147, La Paz'
  },
  {
    id: 'SUP002',
    name: 'Componentes del Sur',
    contact: 'Laura Gómez',
    phone: '2-2234567',
    email: 'info@compsur.com',
    address: 'Calle 21 de Calacoto, La Paz'
  },
  {
    id: 'SUP003',
    name: 'Global Tech Import',
    contact: 'Pedro Quispe',
    phone: '2-2345678',
    email: 'contacto@globaltech.com',
    address: 'Zona Sur, Irpavi, La Paz'
  }
];

export const mockSales: Sale[] = [
  {
    id: 'S001',
    date: '2026-04-13',
    customerId: 'C001',
    customerName: 'Carlos Mendoza',
    customerNit: '1234567-1A',
    products: [
      { productId: '1', quantity: 1, price: 1299.99 },
      { productId: '3', quantity: 1, price: 129.99 }
    ],
    total: 1429.98,
    discount: 0,
    paymentMethod: 'card'
  },
  {
    id: 'S002',
    date: '2026-04-12',
    customerId: 'C002',
    customerName: 'Ana Torres',
    customerNit: '2345678-1B',
    products: [
      { productId: '4', quantity: 2, price: 69.99 }
    ],
    total: 139.98,
    discount: 0,
    paymentMethod: 'cash'
  },
  {
    id: 'S003',
    date: '2026-04-11',
    customerId: 'C003',
    customerName: 'Roberto Silva',
    customerNit: '3456789-1C',
    products: [
      { productId: '2', quantity: 1, price: 599.99 },
      { productId: '9', quantity: 1, price: 89.99 }
    ],
    total: 689.98,
    discount: 0,
    paymentMethod: 'qr'
  },
  {
    id: 'S004',
    date: '2026-04-10',
    customerId: 'C001',
    customerName: 'Carlos Mendoza',
    customerNit: '1234567-1A',
    products: [
      { productId: '6', quantity: 1, price: 899.99 }
    ],
    total: 899.99,
    discount: 0,
    paymentMethod: 'card'
  },
  {
    id: 'S005',
    date: '2026-04-09',
    customerId: 'C003',
    customerName: 'Roberto Silva',
    customerNit: '3456789-1C',
    products: [
      { productId: '5', quantity: 1, price: 449.99 },
      { productId: '7', quantity: 2, price: 159.99 }
    ],
    total: 769.97,
    discount: 0,
    paymentMethod: 'card'
  }
];

export const mockStockMovements: StockMovement[] = [
  {
    id: 'SM001',
    productId: '1',
    type: 'increase',
    quantity: 10,
    reason: 'Compra a proveedor',
    date: '2026-04-01',
    user: 'Admin User'
  },
  {
    id: 'SM002',
    productId: '1',
    type: 'decrease',
    quantity: 1,
    reason: 'Venta S001',
    date: '2026-04-13',
    user: 'John Employee'
  },
  {
    id: 'SM003',
    productId: '3',
    type: 'increase',
    quantity: 15,
    reason: 'Compra a proveedor',
    date: '2026-04-05',
    user: 'Admin User'
  },
  {
    id: 'SM004',
    productId: '4',
    type: 'decrease',
    quantity: 2,
    reason: 'Venta S002',
    date: '2026-04-12',
    user: 'John Employee'
  },
  {
    id: 'SM005',
    productId: '6',
    type: 'increase',
    quantity: 5,
    reason: 'Compra a proveedor',
    date: '2026-04-08',
    user: 'Admin User'
  }
];
