🖥️ Santa Cruz Computer

> Sistema web de **gestión de ventas e inventario** para una tienda de
> computación en Santa Cruz de la Sierra, Bolivia.

![Estado](https://img.shields.io/badge/estado-en%20producción-success)
![Backend](https://img.shields.io/badge/backend-Django%20%2B%20DRF-092E20)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB)
![DB](https://img.shields.io/badge/base%20de%20datos-PostgreSQL%2017-336791)

---

## 📋 Descripción

Plataforma completa que digitaliza la operación de una tienda de computación:
catálogo en línea, ventas presenciales y por internet, control de inventario,
garantías, reseñas y reportes. Tres roles diferenciados y trazabilidad total
mediante una bitácora.

## ✨ Funcionalidades principales

| Módulo | Descripción |
|---|---|
| 🛒 **Tienda en línea** | Catálogo público, carrito y compra con recojo en t
| 💳 **Pago con Stripe** | Cobro con tarjeta en bolivianos (BOB) |
| 📦 **Inventario** | Control de stock, entradas (compras) y salidas (ventas) |
| 🧾 **Ventas y facturas** | Venta presencial/online + factura en PDF |
| 🛡️ **Garantías** | Generación automática por venta y gestión de reclamos |
| ⭐ **Reseñas** | Opiniones verificadas de clientes con moderación |
| 🎙️ **Voz IA** | Descarga de reportes (Excel/PDF) por comandos de voz |
| 👑 **Descuentos VIP** | Bonos por lealtad según monto acumulado |
| 📑 **Bitácora** | Registro de todas las acciones con usuario, IP y fecha |

## 👥 Roles del sistema

- **Administrador** — gestión total: productos, usuarios, proveedores, reportes y bitácora.
- **Vendedor** — registro de ventas, inventario y atención de garantías.
- **Cliente** — compra en línea, seguimiento de pedidos, reclamos y reseñas.

## 🛠️ Tecnologías

**Frontend:** React · TypeScript · Vite · Tailwind CSS · React Router · Lucide Icons
**Backend:** Django · Django REST Framework · JWT · ReportLab (PDF)
**Base de datos:** PostgreSQL 17
**Integraciones:** Stripe (pagos) · Google Gemini (voz IA) · Brevo (correos O
**Despliegue:** Vercel (frontend) · Railway (backend + BD)

## 📂 Estructura del proyecto

### 🐍 Backend (Django + DRF)

```
Backend/
├── config/                 → Configuración Django (settings, urls, wsgi)
├── apps/
│   ├── users/              → Autenticación JWT, usuarios y clientes
│   │   ├── models.py           · Usuario, Cliente
│   │   ├── views.py            · login, logout, OTP, reset de contraseña
│   │   ├── serializers.py
│   │   └── password_rules.py   · reglas de contraseña segura
│   ├── products/           → Catálogo, inventario y proveedores
│   │   ├── models.py           · Producto, Categoría, Proveedor, Compra
│   │   ├── views.py
│   │   └── permissions.py      · permisos por rol
│   ├── orders/             → Ventas, garantías, reseñas y reportes
│   │   ├── models.py           · Venta, Garantía, Reseña, Factura
│   │   ├── views.py            · ventas + factura PDF (ReportLab)
│   │   ├── stripe_views.py     · pagos con Stripe
│   │   ├── garantia_service.py · generación automática de garantías
│   │   └── voz_views.py        · Voz IA (Google Gemini)
│   └── audit/              → Bitácora del sistema
│       ├── models.py
│       └── utils.py            · log_action() + IP del cliente
├── sql/                    → Scripts incrementales (modelos managed=False)
│   ├── 001_descuento_vip.sql
│   ├── 002_garantia.sql
│   └── 003_resena.sql
├── media/                  → Imágenes de productos
└── manage.py
```

### ⚛️ Frontend (React + Vite)

```
Frontend/
├── src/
│   └── app/
│       ├── pages/          → Pantallas del sistema
│       │   ├── Store.tsx        · tienda del cliente
│       │   ├── Cart.tsx         · carrito y checkout
│       │   ├── Orders.tsx       · mis pedidos (cliente)
│       │   ├── Sales.tsx        · registro de ventas
│       │   ├── Inventory.tsx    · control de inventario
│       │   ├── Products.tsx     · gestión de productos
│       │   ├── Suppliers.tsx    · proveedores y compras
│       │   ├── Warranties.tsx   · garantías y reclamos
│       │   ├── Reviews.tsx      · moderación de reseñas
│       │   ├── Users.tsx        · usuarios y clientes
│       │   ├── AuditLog.tsx     · bitácora
│       │   └── Dashboard.tsx    · panel principal
│       ├── components/     → UI reutilizable (Layout, VoiceAssistant, ui/)
│       ├── context/        → Estado global (Auth, Users, Audit)
│       ├── hooks/          → Hooks (useEscapeKey, useBackendAuth)
│       ├── services/       → Cliente de la API (api.ts)
│       ├── utils/          → Exportar Excel/PDF, validaciones
│       └── routes.tsx      → Definición de rutas
├── public/
├── index.html
└── vite.config.ts
```
