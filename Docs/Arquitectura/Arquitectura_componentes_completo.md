# Inventario técnico — Sistema completo (CU1 – CU28)

> **Para qué sirve.** Insumo del **"Diagrama de componentes principales del sistema"** que va en la
> sección *Implementación de la arquitectura*. Todo lo que está acá **fue extraído del código real**,
> con la ruta del archivo citada. Donde algo no existe, lo digo explícitamente.
>
> **Alcance:** sistema completo, los 28 casos de uso, incluyendo los módulos de mis compañeros.
> *(La versión reducida a mis 3 casos de uso está en `Arquitectura_componentes_mis_cu.md`.)*

---

## 1. Estructura general del proyecto

Aplicación full-stack separada en dos despliegues independientes que se comunican por una API REST.

```
Proyecto si1 1-2026/
│
├── Backend/                          Django + Django REST Framework
│   ├── config/
│   │   ├── settings.py               configuración, JWT, CORS, claves de integraciones
│   │   └── urls.py                   monta /api/v1/{users,products,orders,audit}
│   ├── apps/
│   │   ├── users/                    usuarios, clientes, login, OTP, notificaciones
│   │   │   ├── models.py  serializers.py  views.py  urls.py  permissions.py
│   │   ├── products/                 catálogo, inventario, proveedores, compras, promociones
│   │   │   ├── models.py  serializers.py  views.py  urls.py
│   │   ├── orders/                   ventas, pagos, facturas, garantías, reseñas,
│   │   │   │                         devoluciones, servicio técnico, créditos
│   │   │   ├── models.py  serializers.py  urls.py
│   │   │   ├── views.py              (~2.100 líneas — el núcleo del negocio)
│   │   │   ├── stripe_views.py       pago con tarjeta (venta y cuota de crédito)
│   │   │   └── voz_views.py          comandos de voz interpretados con IA
│   │   └── audit/                    bitácora de auditoría
│   │       ├── models.py  serializers.py  views.py  urls.py  utils.py
│   ├── sql/                          13 scripts incrementales aplicados a mano
│   ├── templates/                    plantillas HTML de facturas y correos
│   ├── media/                        imágenes de productos subidas
│   ├── utils.py
│   ├── requirements.txt
│   └── Procfile                      despliegue
│
└── Frontend/                         React + Vite + TypeScript
    └── src/
        ├── app/
        │   ├── routes.tsx            22 rutas
        │   ├── pages/                22 pantallas (una por ruta)
        │   ├── components/
        │   ├── context/              estado global (sesión, carrito)
        │   ├── hooks/
        │   ├── services/
        │   │   └── api.ts            ÚNICO punto de salida hacia el backend
        │   └── utils/
        └── styles/
```

**Dato clave para el diagrama:** el frontend habla con el backend **únicamente a través de
`Frontend/src/app/services/api.ts`**. No hay ningún otro punto de contacto. Eso convierte a `api.ts`
en un componente de frontera limpio.

**Solo hay 4 apps de Django** (`Backend/apps/`), pero `orders` concentra casi todo el dominio de
negocio: ventas, pagos, facturación, garantías, reseñas, devoluciones, servicio técnico y créditos.

---

## 2. Modelo de datos / entidades del dominio

**Nota transversal, importante:** **todos los modelos tienen `managed = False`**
(`Backend/apps/*/models.py`). Django **no crea ni migra** estas tablas: la estructura vive en
PostgreSQL y se modifica con SQL manual (`Backend/sql/`). Django solo lee y escribe.

### 2.1 App `users` — `Backend/apps/users/models.py`

**`Usuario`** (tabla `usuario`) — personal interno.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idusuario`) |
| `nombre_completo` | CharField(150) | |
| `username` | CharField(50) | **UNIQUE** |
| `password_hash` | TextField | hasheada con `make_password` |
| `rol` | CharField(30) | `admin` · `vendedor` · `tecnico` (`RolUsuario`) |
| `activo` | BooleanField | default `True` |
| `email`, `telefono`, `ciudad` | CharField | opcionales |
| `fecha_nacimiento` | DateField | opcional |

**`Cliente`** (tabla `cliente`) — compradores.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idcliente`) |
| `nombre`, `apellido` | CharField(150) | |
| `usuario_login` | CharField(50) | **UNIQUE**, nullable |
| `correo` | CharField(100) | **UNIQUE**, nullable |
| `sexo`, `ciudad`, `telefono` | CharField | opcionales |
| `fecha_nacimiento` | DateField | opcional |
| `nit_ci`, `razon_social` | CharField | opcionales |
| `password` | CharField(255) | hasheada |
| `total_acumulado` | Decimal(12,2) | descuento VIP por fidelidad |
| `descuento_disponible` | Decimal(10,2) | idem |

**`Notificacion`** (tabla `notificacion`) — creada por `Backend/sql/004_notificaciones.sql`.

| Campo | Tipo | Relación |
|---|---|---|
| `id` | AutoField | **PK** (`idnotificacion`) |
| `usuario` | **FK → `Usuario`** | `CASCADE`, nullable |
| `cliente` | **FK → `Cliente`** | `CASCADE`, nullable |
| `tipo`, `titulo`, `mensaje`, `enlace` | Char/Text | |
| `canal` | CharField(20) | `sistema` \| `ambos` (ambos = campana **+ correo**) |
| `leido` | BooleanField | |
| `fecha` | DateTimeField | |

> Una notificación apunta **a un usuario interno O a un cliente**, nunca a los dos (ambas FK son
> nullable).

**`OTPRecovery`** — ⚠️ **modelo declarado pero NO usado**. El propio código lo dice
(`users/models.py:79-84`): *"la tabla `otp_recovery` no existe en BD; los OTPs se almacenan en
memoria en el dict `_otps` de `users/views.py`"*. **No es un componente del sistema real** — no lo
dibujes como tabla.

### 2.2 App `products` — `Backend/apps/products/models.py`

**`Categoria`** (`categoria`): `id` **PK**, `nombre` CharField(100).

**`Producto`** (`producto`):

| Campo | Tipo | Relación |
|---|---|---|
| `id` | AutoField | **PK** (`idproducto`) |
| `categoria` | **FK → `Categoria`** | `SET_NULL`, nullable |
| `nombre` | CharField(150) | |
| `marca`, `modelo` | CharField(50) | opcionales |
| `imagen_url` | ImageField | sube a `productos/` |
| `precio_compra` | Decimal(10,2) | nullable |
| `precio_actual` | Decimal(10,2) | precio de venta |
| `stock_fisico` | IntegerField | **lo mantienen triggers de PostgreSQL** |
| `stock_minimo` | IntegerField | umbral de alerta |
| `descripcion` | TextField | |
| `meses_garantia` | IntegerField | 0 = sin garantía |

Propiedad calculada `is_low_stock` = `stock_fisico <= stock_minimo` (`products/models.py:70-73`).

**`Proveedor`** (`proveedor`): `id` **PK**, `nombre_empresa`, `nit` (**UNIQUE**), `razon_social`,
`contacto_nombre`, `telefono`, `correo`, `direccion`, `ciudad`, `activo`, `fecha_registro`.

**`Compra`** (`compra`): `id` **PK**, **FK → `Proveedor`** (`DO_NOTHING`, nullable), `fecha_compra`,
`monto_total` (**calculado por trigger**).

**`DetalleCompra`** (`detallecompra`): `id` **PK**, **FK → `Compra`** (`CASCADE`),
**FK → `Producto`** (`DO_NOTHING`), `cantidad`, `costo_unitario`.

**`Promocion`** (`promocion`) — creada por `Backend/sql/006_promociones.sql`:

| Campo | Tipo | Relación |
|---|---|---|
| `id` | AutoField | **PK** (`idpromocion`) |
| `producto` | **FK → `Producto`** | `CASCADE` |
| `porcentaje` | Decimal(5,2) | 1.00 a 100.00 |
| `fecha_inicio`, `fecha_fin` | DateField | vigencia |
| `activo` | BooleanField | |

### 2.3 App `orders` — `Backend/apps/orders/models.py`

**Núcleo de la venta**

**`Venta`** (`venta`): `id` **PK**, **FK → `Cliente`** (nullable), **FK → `Usuario`** (nullable),
`fecha_venta`, `monto_total` (**trigger**), `estado` (`pending`\|`completed`, **trigger**),
`estado_entrega` (`pendiente`\|`entregado`), `pedido_online` (Boolean), `descuento_aplicado`.

**`DetalleVenta`** (`detalleventa`): `id` **PK**, **FK → `Venta`** (`CASCADE`),
**FK → `Producto`**, `cantidad`, `precio_unitario`.
`subtotal` **no es un campo Django**: es una columna `GENERATED ALWAYS AS (cantidad *
precio_unitario) STORED` en PostgreSQL (`orders/models.py:115-120`).

**`PagoVenta`** (`pagoventa`): `id` **PK**, **FK → `Venta`** (`CASCADE`), `monto`,
`metodo` (`qr`\|`transferencia`\|`efectivo`\|`tarjeta`), `fecha`.

**`Factura`** (`factura`): `id` **PK**, **OneToOne → `Venta`**, `nro_factura`, `cuf`, `cufd`,
`estado_siat` (`PENDIENTE`\|`ACEPTADO`\|`RECHAZADO`\|`ANULADO`), `fecha_emision`.

**Posventa**

**`Garantia`** (`garantia`): `id` **PK**, **FK → `Venta`**, **OneToOne → `DetalleVenta`** *(una
garantía por ítem vendido)*, **FK → `Producto`**, **FK → `Cliente`** (nullable), `cantidad`, `meses`,
`fecha_inicio`, `fecha_fin`, `estado` (`activa`\|`reclamada`\|`aprobada`\|`rechazada`),
`motivo_reclamo`, `fecha_reclamo`, `resolucion`, `fecha_resolucion`.
El estado *"vencida"* **no se guarda**: se deriva comparando `fecha_fin` con hoy
(`orders/models.py:196-199`).

**`Resena`** (`resena`): `id` **PK**, **OneToOne → `Venta`** *(1 reseña por venta)*,
**FK → `Cliente`**, `puntuacion`, `comentario`, `estado` (`visible`\|`oculto`), `fecha`.

**`Devolucion`** (`devolucion`) — `Backend/sql/005_devoluciones.sql` + `011_devolucion_inspeccion.sql`:
`id` **PK**, **FK → `Venta`**, **FK → `DetalleVenta`**, **FK → `Producto`**, **FK → `Cliente`**,
**FK → `Usuario`**, `cantidad`, `motivo`, `estado` (`aprobada`\|`rechazada`), `motivo_rechazo`,
`monto_reembolso`, `fecha`, y 4 booleanos de inspección física: `insp_sin_dano`,
`insp_sin_manipulacion`, `insp_mismo_producto`, `insp_completo`.

**Servicio técnico** — `Backend/sql/007_servicios_tecnicos.sql`, `012`, `013`

- **`ServicioCatalogo`** (`servicio_catalogo`): `id` **PK**, `nombre`, `tipo`
  (`preventivo`\|`correctivo`), `equipo` (`laptop`\|`escritorio`), `precio`, `activo`.
- **`OrdenServicio`** (`orden_servicio`): `id` **PK**, **FK → `Cliente`**, **FK → `Usuario`**
  (el técnico), **FK → `Garantia`** (nullable), **FK → `Producto`** (`producto_referencia`,
  `SET_NULL`), `tipo`, `origen`, `equipo`, `equipo_descripcion`, `es_beneficio`, `diagnostico`,
  `observaciones`, `costo_total`, `estado`
  (`solicitado`\|`agendado`\|`en_proceso`\|`finalizado`\|`entregado`\|`cancelado`),
  `fecha_solicitud`, `fecha_agendada`, `fecha_finalizacion`, `fecha_entrega_prevista`,
  `fecha_entrega_real`.
- **`OrdenDetalle`** (`orden_detalle`): `id` **PK**, **FK → `OrdenServicio`** (`CASCADE`),
  **FK → `ServicioCatalogo`**, `precio`.
- **`TareaServicio`** (`tarea_servicio`): `id` **PK**, **FK → `OrdenServicio`** (`CASCADE`), `tarea`,
  `realizado`.

**Crédito** — `Backend/sql/009_credito.sql` + `010_checklist_credito.sql`

- **`PlanCredito`** (`plan_credito`): `id` **PK**, **FK → `Venta`**, **FK → `DetalleVenta`**,
  **FK → `Producto`**, **FK → `Cliente`**, **FK → `Usuario`**, `precio_unitario`, `cantidad`,
  `precio_base`, `recargo_pct`, `precio_financiado`, `inicial`, `n_cuotas`, `monto_cuota`, `saldo`,
  `estado` (`vigente`\|`pagado`\|`moroso`), `origen` (`walk_in`\|`al_credito_sales`),
  `numero_factura`, `fecha`.
  ⚠️ **El plan cuelga del ítem, no de la venta**: es un plan **por producto**.
- **`Cuota`** (`cuota`): `id` **PK**, **FK → `PlanCredito`** (`CASCADE`), `numero`, `monto`, `mora`,
  `fecha_vencimiento`, `fecha_pago`, `estado` (`pendiente`\|`pagada`\|`vencida`),
  **FK → `Usuario`** (`usuario_cobro`), `stripe_payment_intent_id`, `stripe_session_pending`,
  `metodo_pago` (`efectivo`\|`stripe`), `numero_factura`.
- **`ChecklistCredito`** (`checklist_credito`): `id` **PK**, **OneToOne → `PlanCredito`**,
  `tipo_empleo` (`dependiente`\|`independiente`), `antiguedad_meses`, y los booleanos documentales:
  `ci_solicitante`, `ci_conyuge`, `factura_servicios`, `boletas_pago`, `extracto_gestora`,
  `facturas_ultimo_ano`, `estados_financieros`, `nit`, `croquis_domicilio`, `croquis_negocio`,
  `respaldos_patrimoniales`, `observaciones`, `fecha_verificacion`.

### 2.4 App `audit` — `Backend/apps/audit/models.py`

**`Bitacora`** (`bitacora`): `id` **PK**, **FK → `Usuario`** (`SET_NULL`), `usuario_nombre`,
`usuario_rol`, `accion` (`LOGIN`\|`LOGOUT`\|`CREATE`\|`UPDATE`\|`DELETE`\|`STOCK`\|`VENTA`\|`COMPRA`\|`RESET_PW`),
`modulo`, `descripcion`, `ip_address`, `fecha`.

> **Quién escribe acá:** nunca el usuario. Solo el sistema, vía `log_action()` en
> `Backend/apps/audit/utils.py`, llamada desde los ViewSets de cada módulo
> (`audit/models.py:6-8`). **En el diagrama, la Bitácora es un componente al que apuntan flechas
> desde casi todos los demás.**

### 2.5 Relaciones sin llave foránea declarada

⚠️ Dos columnas **funcionan como FK pero la base no las obliga**: `compra.idproveedor` y
`venta.idcliente`. La relación existe en el modelo Django y la aplicación la respeta, pero en
PostgreSQL no hay `FOREIGN KEY`.

---

## 3. Operaciones del sistema (endpoints)

Prefijo global `/api/v1/` (`Backend/config/urls.py`). Todos los ViewSets son de DRF con
`DefaultRouter`, así que exponen el CRUD estándar (`GET` lista, `POST` crea, `GET/PATCH/DELETE` por id).

### 3.1 `/api/v1/users/` — `Backend/apps/users/urls.py`

| Ruta | Método | Qué hace | Entidad | Auth |
|---|---|---|---|---|
| `/login/` | POST | Inicia sesión, devuelve JWT | Usuario / Cliente | ❌ pública |
| `/logout/` | POST | Cierra sesión, registra en bitácora | Bitacora | ✅ |
| `/check-email/` | GET | Verifica si un email ya existe | Cliente | ❌ pública |
| `/forgot-password/` | POST | Envía código OTP por correo | *(OTP en memoria)* | ❌ pública |
| `/reset-password/` | POST | Verifica OTP y cambia la contraseña | Usuario / Cliente | ❌ pública |
| `/change-password/` | POST | Cambia contraseña estando logueado | Usuario / Cliente | ✅ |
| `/blocked-accounts/` | GET | Cuentas con intentos fallidos | *(en memoria)* | ✅ admin |
| `/unblock-account/` | POST | Desbloquea una cuenta | *(en memoria)* | ✅ admin |
| `/notificaciones/` | GET | Notificaciones del usuario/cliente | Notificacion | ✅ |
| `/notificaciones/marcar-leidas/` | POST | Marca como leídas | Notificacion | ✅ |
| `/clientes/` | CRUD | Gestión de clientes | Cliente | `PublicCreateElseAuthenticated` (registro público, el resto con token) |
| `/` | CRUD | Gestión de usuarios internos | Usuario | ✅ **solo admin** (`IsAdmin`) |
| `/{id}/update_role/` | PATCH | Cambia el rol de un usuario | Usuario | ✅ admin |

### 3.2 `/api/v1/products/` — `Backend/apps/products/urls.py`

| Ruta | Método | Qué hace | Entidad | Auth |
|---|---|---|---|---|
| `/` | CRUD | Catálogo de productos | Producto | `AdminWriteOrReadOnly` — **lectura pública**, escritura solo admin |
| `/low_stock/` | GET | Productos con stock ≤ mínimo | Producto | idem |
| `/{id}/adjust_stock/` | POST | Ajuste manual de stock | Producto + Bitacora | admin |
| `/categorias/` | CRUD | Categorías | Categoria | `AdminWriteOrReadOnly` |
| `/proveedores/` | CRUD | Proveedores | Proveedor | `AdminWriteStaffRead` — **leer exige sesión** (dato interno) |
| `/compras/` | CRUD | Compras a proveedor | Compra + DetalleCompra | `AdminWriteStaffRead` (costos) |
| `/promociones/` | CRUD | **Promociones programadas** | Promocion | `AdminWriteOrReadOnly` |

### 3.3 `/api/v1/orders/` — `Backend/apps/orders/urls.py`

**Todos los ViewSets de este módulo exigen `IsAuthenticatedJWT`** salvo lo que se indique.

| Ruta | Método | Qué hace | Entidad |
|---|---|---|---|
| `/ventas/` | CRUD | Ventas | Venta |
| `/ventas/{id}/confirmar_entrega/` | PATCH | Confirma la entrega | Venta |
| `/ventas/by_vendedor/` | GET | Ventas de un vendedor | Venta |
| `/ventas/historial/` | GET | Estadísticas del vendedor | Venta |
| `/ventas/{id}/pdf/` | GET | **Descarga la factura en PDF** | Factura |
| `/pagos/` | CRUD | Pagos de una venta | PagoVenta |
| `/detalles/` | GET | Ítems de venta (solo lectura) | DetalleVenta |
| `/garantias/` | CRUD + acciones | Garantías, reclamo y resolución | Garantia |
| `/garantias/generar-retroactivas/` | POST | Genera garantías de ventas viejas | Garantia |
| `/resenas/` | CRUD | Reseñas y moderación | Resena |
| `/devoluciones/` | CRUD | Devoluciones (RMA) con inspección | Devolucion |
| `/servicios-catalogo/` | CRUD | Catálogo de servicios técnicos | ServicioCatalogo |
| `/ordenes-servicio/` | CRUD + acciones | Órdenes de servicio, estados | OrdenServicio |
| `/ordenes-servicio/productos-cliente/` | GET | Productos que compró el cliente | Producto |
| **`/planes-credito/`** | CRUD | **Planes de crédito** | PlanCredito |
| **`/planes-credito/walk-in/`** | POST | **Crédito presencial (atómico)** | Venta + Plan + Cuotas |
| **`/planes-credito/desde-venta/`** | POST | **Crédito desde el método "Al crédito"** | PlanCredito |
| **`/planes-credito/mis-creditos/`** | GET | **Los créditos del cliente logueado** | PlanCredito |
| **`/planes-credito/pagar-cuota/`** | PATCH | **Cobro de cuota en efectivo** | Cuota + Factura |
| **`/planes-credito/cartera/`** | GET | **Cartera consolidada** | *(agregación)* |
| **`/planes-credito/elegibilidad/`** | GET | **¿El cliente puede recibir crédito?** | PlanCredito + Cuota |

**Stripe** — `Backend/apps/orders/stripe_views.py`:

| Ruta | Método | Qué hace | Auth |
|---|---|---|---|
| `/stripe/create-checkout-session/` | POST | Abre el pago de una **venta** | ❌ `AllowAny` |
| `/stripe/confirm/` | POST | Confirma el pago y **recién ahí crea la venta** | ❌ `AllowAny` |
| `/stripe/checkout-cuota/` | POST | Abre el pago de una **cuota de crédito** | ✅ |
| `/stripe/confirmar-cuota/` | POST | Confirma el pago de la cuota | ✅ |
| `/stripe/verificar-cuota-pendiente/` | GET | Recupera un pago sin webhook | ✅ |

**Voz / IA** — `Backend/apps/orders/voz_views.py`:

| Ruta | Método | Qué hace | Auth |
|---|---|---|---|
| `/voz-intencion/` | POST | Interpreta un comando hablado y devuelve la intención | ✅ `IsAuthenticatedJWT` (línea 84) |

### 3.4 `/api/v1/audit/` — `Backend/apps/audit/urls.py`

| Ruta | Método | Qué hace | Auth |
|---|---|---|---|
| `/` | GET | Lista la bitácora (con `?search=` y `?ordering=`) | ✅ **solo admin** (`IsAdminRole`, `audit/views.py:27`) |
| `/{id}/` | GET | Un registro | ✅ admin |

---

## 4. Reglas de negocio

### 4.1 En la base de datos — triggers de PostgreSQL

**7 funciones `plpgsql`.** Mantienen stock y totales **automáticamente**: la aplicación inserta el
detalle y la base hace el resto. Esto es central para el diagrama: **hay lógica de negocio DENTRO de
la base de datos**, no solo en Django.

| Trigger | Sobre la tabla | Qué hace |
|---|---|---|
| `trigger_validar_stock` | `detalleventa` | **Rechaza la venta** si no hay stock suficiente |
| `trigger_stock_venta` | `detalleventa` | **Descuenta** `producto.stock_fisico` |
| `trigger_total_venta` | `detalleventa` | Recalcula `venta.monto_total` |
| `trigger_estado_venta` | `pagoventa` | Pasa la venta a `completed` cuando los pagos cubren el total |
| `trigger_compra_stock` | `detallecompra` | **Suma** stock al comprar a un proveedor |
| `trigger_total_compra` | `detallecompra` | Recalcula `compra.monto_total` |
| `trigger_devolucion_stock` | `devolucion` | **Devuelve** el stock, solo si la devolución es `aprobada` (`Backend/sql/005_devoluciones.sql:37-49`) |

**Excepción de `trigger_estado_venta`:** si `venta.pedido_online = True`, la venta **NO** se completa
sola — queda en `pending` hasta que el admin confirme la entrega (`orders/models.py:17-19`).

> ⚠️ **Ni las promociones ni el crédito tienen triggers.** Toda su lógica vive en el backend.

### 4.2 En el backend

**Promociones** — `Backend/apps/products/serializers.py:28, 43, 147-150`
El `precio_promocional` **no se guarda**: es un `SerializerMethodField` que se **calcula al leer**,
comparando la fecha actual contra `fecha_inicio`/`fecha_fin` y aplicando
`precio * (1 - porcentaje/100)`. Si no hay promoción vigente, devuelve `None`. Por eso, al vencer la
promoción, el precio vuelve solo a su valor normal.

**Crédito** — `Backend/apps/orders/views.py:1398-1450`

Tarifario **hardcodeado en Python**, no hay tabla de parámetros:

| Precio unitario del producto | Cuotas | Recargo |
|---|---|---|
| 1 – 5.000 Bs | 6 | 20 % |
| 5.001 – 10.000 Bs | 9 | 25 % |
| 10.001 – 15.000 Bs | 12 | 30 % |

- **Fuera de esos rangos, el producto no califica** (`calcular_credito` devuelve `None`).
- **Cuota inicial: 20 %** del precio financiado (`CREDITO_INICIAL_PCT`).
- **Mora: 10 %** sobre la cuota vencida (`CREDITO_MORA_PCT`).
- El rango lo decide el **precio unitario**; el financiamiento se calcula sobre el **total**.
- La **última cuota absorbe el residuo del redondeo** para que las cuotas sumen exacto el saldo
  (`views.py:1442-1444`).

**Mora perezosa** — `_refrescar_moras(plan)` (`views.py:1549-1561`)
**No hay tarea programada ni cron.** La mora se recalcula **cuando alguien lee el plan**. Aplica el
10 % sobre la cuota vencida y actualiza el estado del plan (`vigente` / `moroso` / `pagado`).

**Bloqueo del cliente** — `views.py:1686-1703` y `1756-1765`
Un cliente **no puede recibir un crédito nuevo** si `cuotas_vencidas > 0` **o** si ya tiene
**3 créditos activos** (`vigente` o `moroso`). Al llegar a 2 activos, la API devuelve una
`advertencia`; al llegar a 3, **rechaza**.

**Numeración de facturas de crédito** — `views.py:1453-1464`
Formato `FCR-{año}-{correlativo:06d}`, con la secuencia PostgreSQL `factura_credito_seq` para
garantizar unicidad aunque haya inserciones en paralelo.

**Atomicidad del crédito walk-in** — endpoint `/planes-credito/walk-in/`
Crea venta + detalle + plan + cuotas + pago inicial **en una sola transacción**. Si algo falla, no
queda nada a medias.

**Descuento VIP** — `Backend/sql/001_descuento_vip.sql`, `cliente.total_acumulado` /
`descuento_disponible` (`users/models.py:64-66`): cada 10.000 Bs acumulados otorgan 200 Bs de
descuento. **Es distinto de las promociones.**

**Garantías** — `orders/models.py:196-199`: nacen al crear la venta
(`fecha_fin = fecha_venta + producto.meses_garantia`). El estado *"vencida"* se **deriva**, no se guarda.

**Señales de Django (`signals.py`):** ❌ **No encontrado en el código.** No hay ningún archivo
`signals.py` en las 4 apps. La lógica está en los ViewSets, los serializers y los triggers.

---

## 5. Integraciones externas

Todas se configuran por variables de entorno en `Backend/config/settings.py`.

| Servicio | Para qué | Dónde se invoca | Configuración |
|---|---|---|---|
| **Stripe** | Pago con tarjeta de **ventas** y de **cuotas de crédito**. Cobra en **BOB**. Flujo **sin webhook**: el cliente paga en el Checkout hospedado de Stripe y, al volver, el backend confirma la sesión y **recién ahí crea la venta**. | `Backend/apps/orders/stripe_views.py` | `settings.py:281-285` — `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY=bob`. Dependencia: `stripe==9.12.0` |
| **Brevo** | Correos transaccionales por **API HTTP** (no SMTP): código OTP de recuperación, facturas, comprobantes de cuota, avisos al cliente. | `Backend/apps/users/views.py` → `_send_brevo_email` | `settings.py:268-274` — `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` |
| **Google Gemini** | Interpreta **comandos de voz** del administrador para descargar reportes. El frontend intenta primero con reglas locales; si no puede, manda el texto al backend, que consulta a Gemini. | `Backend/apps/orders/voz_views.py` | `settings.py:288-294` — `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.0-flash` |
| **ReportLab** | Genera el **PDF de la factura** de venta. | `FacturaPDFView` → `/ventas/{id}/pdf/` (`orders/urls.py:37`) | `requirements.txt:13` — `reportlab==4.0.9` |
| **SMTP (Django mail)** | Backend de correo alternativo. En desarrollo imprime en consola (`console.EmailBackend`). | `settings.py:257-265` | `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`… |
| **Plantillas HTML** | Facturas de crédito (inicial y cuota) y correos de marca. | `Backend/templates/` | — |

> **Nota:** hay **dos caminos de correo** — Brevo por API HTTP (el que se usa de verdad) y el backend
> SMTP de Django (configurable). En el diagrama conviene mostrar **Brevo**.

---

## 6. Actores del sistema

Definidos en `RolUsuario` (`Backend/apps/users/models.py:17-20`) más el `Cliente`, que es una
entidad aparte. **Cuatro actores.**

| Actor | Dónde vive | Qué puede hacer (según los permisos del código) |
|---|---|---|
| **Administrador** | `Usuario.rol = 'admin'` | Todo. Único que puede: gestionar usuarios (`IsAdmin`), ver la **bitácora** (`IsAdminRole`), crear/editar productos, categorías y **promociones** (`AdminWriteOrReadOnly`), registrar compras y proveedores (`AdminWriteStaffRead`), ajustar stock, confirmar entregas, moderar reseñas, ver la **cartera de créditos**, usar el **asistente de voz**. |
| **Vendedor** | `Usuario.rol = 'vendedor'` | Registrar ventas y pagos, cobrar cuotas, registrar créditos (walk-in y "Al crédito"), registrar devoluciones, consultar productos y proveedores. **No** accede a la bitácora ni a la gestión de usuarios. |
| **Técnico** | `Usuario.rol = 'tecnico'` | Órdenes de servicio: agendar, ejecutar, completar el checklist, cambiar estados, registrar diagnóstico y entrega. Rol agregado por `Backend/sql/008_rol_tecnico.sql`. |
| **Cliente** | Tabla `cliente` (no es `Usuario`) | Registrarse (**público**), navegar el catálogo (**público**), comprar en línea, pagar con tarjeta, ver sus pedidos, sus garantías, sus servicios y **sus créditos**; pagar cuotas en línea; dejar reseñas; solicitar devoluciones. |
| *(visitante sin sesión)* | — | Solo lectura del catálogo, categorías y promociones (`AdminWriteOrReadOnly` permite `GET` sin token) + registrarse + login + recuperar contraseña. |

**Mecanismo de autenticación:** JWT (`rest_framework_simplejwt`). Las clases de permiso están en
`Backend/apps/users/permissions.py`:

- `IsAuthenticatedJWT` — requiere token válido, cualquier rol.
- `IsAdmin` — el claim `role` del JWT debe ser `admin`.
- `PublicCreateElseAuthenticated` — permite el `POST` de registro sin token; todo lo demás con token.
- `AdminWriteOrReadOnly` / `AdminWriteStaffRead` — en `products/views.py`.
- `IsAdminRole` — en `audit/views.py:27`.

---

## 7. Componentes para el diagrama

Síntesis de todo lo anterior, ya ordenada como componentes y conexiones.

### Componentes

**Capa cliente (navegador)**
- `Landing / Tienda` · `Carrito` · `Panel de administración` · `Panel del vendedor` ·
  `Panel del técnico` · `Mis pedidos / Mis créditos / Mis servicios`
- **`api.ts` — cliente HTTP** *(única frontera hacia el backend)*

**Capa de aplicación (Django REST Framework)**
- **Middleware de autenticación JWT + capa de permisos**
- App **`users`** → Autenticación · Gestión de usuarios · Gestión de clientes · Notificaciones
- App **`products`** → Catálogo · Inventario · Proveedores · Compras · **Promociones**
- App **`orders`** → Ventas · Pagos · Facturación · Garantías · Reseñas · Devoluciones ·
  Servicio técnico · **Créditos y cartera** · Pasarela Stripe · Asistente de voz
- App **`audit`** → Bitácora

**Capa de datos**
- **PostgreSQL** (34 tablas) — **con lógica de negocio propia: 7 triggers** de stock y totales
- Almacenamiento de imágenes (`Backend/media/`)

**Servicios externos**
- **Stripe** (pagos) · **Brevo** (correos) · **Google Gemini** (voz) · **ReportLab** (PDF, librería
  local, no es un servicio remoto)

### Conexiones que no hay que olvidar

- Todo el frontend pasa **solo** por `api.ts`.
- **Todas** las peticiones cruzan el middleware JWT, salvo: login, registro de cliente, recuperación
  de contraseña, lectura del catálogo y los dos endpoints de Stripe marcados `AllowAny`.
- Casi todos los módulos escriben en la **Bitácora** (vía `audit/utils.py → log_action()`).
- **PostgreSQL no es un almacén pasivo**: los triggers descuentan stock, recalculan totales y
  completan ventas. Conviene dibujarlo con un compartimiento *"Triggers"*.
- **Créditos → Brevo** (comprobante de cuota) y **Créditos → Stripe** (pago en línea de la cuota).
- **Créditos → Notificaciones** (campana al cliente).

---

## 8. Prompt listo para el navegador

*(Copiá desde acá hasta el final y pegalo en claude.ai junto con las secciones 1 a 7 de este documento.)*

> Necesito el **"Diagrama de componentes principales del sistema"** para la sección *Implementación
> de la arquitectura* de mi documentación (UML de componentes).
>
> El sistema es **Santa Cruz-Computer**, una aplicación web de gestión de inventario, ventas y
> créditos. Te paso el inventario técnico completo, extraído del código real.
>
> **Dibujá un diagrama de componentes UML** con estas cuatro capas, de arriba hacia abajo:
>
> 1. **Cliente (navegador)** — React + Vite + TypeScript. Mostrá las pantallas agrupadas por rol
>    (tienda pública, panel admin, panel vendedor, panel técnico, portal del cliente) y, debajo,
>    el componente **`api.ts`**, que es el **único punto de salida** hacia el backend.
> 2. **Aplicación (Django REST Framework)** — un componente por cada app (`users`, `products`,
>    `orders`, `audit`), con sus sub-módulos internos. Antes de ellas, un componente
>    **"Autenticación JWT + Permisos"** que intercepta todas las peticiones.
> 3. **Datos** — **PostgreSQL**, dibujado con un compartimiento aparte llamado **"Triggers"**,
>    porque la base **tiene lógica de negocio propia** (valida y descuenta stock, recalcula totales,
>    completa ventas, devuelve stock en las devoluciones). Más el almacenamiento de imágenes.
> 4. **Servicios externos** — **Stripe** (pagos con tarjeta, en BOB), **Brevo** (correos por API
>    HTTP) y **Google Gemini** (interpretación de comandos de voz).
>
> **Requisitos:**
> - Usá la notación UML de componentes: rectángulos con el ícono de componente, e **interfaces
>   provistas/requeridas** (bolita y media luna) entre `api.ts` y el backend.
> - Etiquetá el protocolo en las flechas: `REST/JSON + JWT` del frontend al backend, `HTTPS` hacia
>   los servicios externos, `SQL` hacia PostgreSQL.
> - Marcá con un color distinto los componentes que atraviesan todo el sistema: **Autenticación JWT**
>   y **Bitácora** (casi todos los módulos le escriben).
> - El diagrama tiene que **caber y leerse en una hoja A4 vertical**. Priorizá la claridad sobre el
>   detalle: si un sub-módulo no aporta, agrupalo.
> - Español, sin abreviaturas raras.
> - Entregámelo como **artifact SVG** para poder exportarlo en alta resolución.
