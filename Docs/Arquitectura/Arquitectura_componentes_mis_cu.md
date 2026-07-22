# Inventario técnico — Mi documento (CU1 – CU19 + mis 3 casos de uso)

> **Para qué sirve.** Insumo del **"Diagrama de componentes principales del sistema"** que va en la
> sección *Implementación de la arquitectura* de **mi** documento. Todo fue extraído del código real,
> con la ruta citada. Donde algo no existe, lo digo.
>
> ## Alcance de este documento
>
> - **CU1 – CU19: base compartida.** La presentamos los tres integrantes por igual. Entra completa:
>   usuarios y roles, catálogo, inventario, proveedores, compras, ventas, carrito, pagos,
>   facturación, garantías, reseñas y bitácora.
> - **Ciclo 5: solo mis tres módulos.**
>
>   | Mi CU | CU del grupo | Módulo |
>   |---|---|---|
>   | **CU20** ⭐ | CU23 / CU24 | **Promociones programadas** |
>   | **CU21** ⭐ | CU27 / CU28 | **Venta a crédito** |
>   | **CU22** ⭐ | CU28 / CU29 | **Cartera de créditos / cobranza** |
>
> - **Deliberadamente fuera:** devoluciones (RMA), servicio técnico, notificaciones, chatbot y
>   asistente de voz con IA. **Existen en el sistema desplegado, pero son de mis compañeros.** No los
>   dibujo como componentes míos.
>
> *(La versión completa del sistema está en `Arquitectura_componentes_completo.md`.)*

---

## 1. Estructura general del proyecto

Aplicación full-stack, dos despliegues independientes que se comunican por una API REST.

```
Proyecto si1 1-2026/
│
├── Backend/                          Django + Django REST Framework
│   ├── config/
│   │   ├── settings.py               configuración, JWT, CORS, claves de integraciones
│   │   └── urls.py                   monta /api/v1/{users,products,orders,audit}
│   ├── apps/
│   │   ├── users/                    usuarios, clientes, login, recuperación de contraseña
│   │   ├── products/                 catálogo, inventario, proveedores, compras
│   │   │                             └── ⭐ PROMOCIONES
│   │   ├── orders/                   ventas, pagos, facturación, garantías, reseñas
│   │   │   │                         └── ⭐ CRÉDITOS Y CARTERA
│   │   │   ├── views.py              lógica de negocio (incluye todo el cálculo del crédito)
│   │   │   └── stripe_views.py       pago con tarjeta (venta y cuota de crédito)
│   │   └── audit/                    bitácora de auditoría
│   ├── sql/                          scripts incrementales aplicados a mano
│   │                                 └── ⭐ 006_promociones · 009_credito · 010_checklist_credito
│   ├── templates/                    plantillas HTML de facturas
│   └── requirements.txt
│
└── Frontend/                         React + Vite + TypeScript
    └── src/app/
        ├── routes.tsx
        ├── pages/                    ⭐ Promociones.tsx · Creditos.tsx · MisCreditos.tsx
        ├── components/  context/  hooks/  utils/
        └── services/
            └── api.ts                ÚNICO punto de salida hacia el backend
```

**Dato clave para el diagrama:** el frontend habla con el backend **únicamente a través de
`Frontend/src/app/services/api.ts`**. Es la frontera limpia entre las dos capas.

**Un matiz honesto que conviene conocer:** el backend tiene **solo 4 apps de Django**. Mis tres
módulos **no son apps separadas**: Promociones vive dentro de `products`, y Créditos + Cartera viven
dentro de `orders`. Por eso el diagrama de componentes se dibuja a nivel de **sub-módulos**, no de
apps — si no, mi aporte no se distinguiría.

---

## 2. Modelo de datos / entidades del dominio

**Nota transversal:** **todos los modelos tienen `managed = False`** (`Backend/apps/*/models.py`).
Django **no crea ni migra** estas tablas: la estructura vive en PostgreSQL y se modifica con SQL
manual (`Backend/sql/`). Django solo lee y escribe.

### 2.1 Base compartida — App `users` (`Backend/apps/users/models.py`)

**`Usuario`** (tabla `usuario`) — personal interno.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idusuario`) |
| `nombre_completo` | CharField(150) | |
| `username` | CharField(50) | **UNIQUE** |
| `password_hash` | TextField | hasheada con `make_password` |
| `rol` | CharField(30) | `admin` · `vendedor` · `tecnico` (`RolUsuario`) |
| `activo` | BooleanField | |
| `email`, `telefono`, `ciudad`, `fecha_nacimiento` | | opcionales |

**`Cliente`** (tabla `cliente`) — compradores.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idcliente`) |
| `nombre`, `apellido` | CharField(150) | |
| `usuario_login` | CharField(50) | **UNIQUE**, nullable |
| `correo` | CharField(100) | **UNIQUE**, nullable |
| `nit_ci`, `razon_social` | CharField | ⭐ **el crédito usa `nit_ci`** |
| `password` | CharField(255) | hasheada |
| `total_acumulado` / `descuento_disponible` | Decimal | descuento VIP por fidelidad |
| `sexo`, `ciudad`, `telefono`, `fecha_nacimiento` | | opcionales |

> ⚠️ **`OTPRecovery`** es un modelo declarado pero **NO usado**: el propio código dice
> (`users/models.py:79-84`) que *"la tabla `otp_recovery` no existe en BD"* y que los OTPs se guardan
> **en memoria**. **No es una tabla real — no lo dibujes.**

### 2.2 Base compartida — App `products` (`Backend/apps/products/models.py`)

**`Categoria`** (`categoria`): `id` **PK**, `nombre`.

**`Producto`** (`producto`): `id` **PK**, **FK → `Categoria`** (`SET_NULL`), `nombre`, `marca`,
`modelo`, `imagen_url`, `precio_compra`, `precio_actual`, `stock_fisico` *(lo mantienen triggers)*,
`stock_minimo`, `descripcion`, `meses_garantia`.
Propiedad `is_low_stock` = `stock_fisico <= stock_minimo` (`products/models.py:70-73`).

**`Proveedor`** (`proveedor`): `id` **PK**, `nombre_empresa`, `nit` (**UNIQUE**), `razon_social`,
`contacto_nombre`, `telefono`, `correo`, `direccion`, `ciudad`, `activo`, `fecha_registro`.

**`Compra`** (`compra`): `id` **PK**, **FK → `Proveedor`**, `fecha_compra`, `monto_total` *(trigger)*.

**`DetalleCompra`** (`detallecompra`): `id` **PK**, **FK → `Compra`** (`CASCADE`),
**FK → `Producto`**, `cantidad`, `costo_unitario`.

### 2.3 Base compartida — App `orders` (`Backend/apps/orders/models.py`)

**`Venta`** (`venta`): `id` **PK**, **FK → `Cliente`** (nullable), **FK → `Usuario`** (nullable),
`fecha_venta`, `monto_total` *(trigger)*, `estado` (`pending`\|`completed`, *trigger*),
`estado_entrega`, `pedido_online`, `descuento_aplicado`.

**`DetalleVenta`** (`detalleventa`): `id` **PK**, **FK → `Venta`** (`CASCADE`), **FK → `Producto`**,
`cantidad`, `precio_unitario`.
`subtotal` **no es campo Django**: es columna `GENERATED ALWAYS AS (cantidad * precio_unitario)
STORED` en PostgreSQL (`orders/models.py:115-120`).

**`PagoVenta`** (`pagoventa`): `id` **PK**, **FK → `Venta`** (`CASCADE`), `monto`,
`metodo` (`qr`\|`transferencia`\|`efectivo`\|`tarjeta`), `fecha`.

**`Factura`** (`factura`): `id` **PK**, **OneToOne → `Venta`**, `nro_factura`, `cuf`, `cufd`,
`estado_siat`, `fecha_emision`.

**`Garantia`** (`garantia`) — CU18: `id` **PK**, **FK → `Venta`**, **OneToOne → `DetalleVenta`**,
**FK → `Producto`**, **FK → `Cliente`**, `cantidad`, `meses`, `fecha_inicio`, `fecha_fin`, `estado`,
`motivo_reclamo`, `fecha_reclamo`, `resolucion`, `fecha_resolucion`.

**`Resena`** (`resena`) — CU19: `id` **PK**, **OneToOne → `Venta`**, **FK → `Cliente`**,
`puntuacion`, `comentario`, `estado` (`visible`\|`oculto`), `fecha`.

### 2.4 Base compartida — App `audit` (`Backend/apps/audit/models.py`)

**`Bitacora`** (`bitacora`) — CU16: `id` **PK**, **FK → `Usuario`** (`SET_NULL`), `usuario_nombre`,
`usuario_rol`, `accion` (`LOGIN`\|`LOGOUT`\|`CREATE`\|`UPDATE`\|`DELETE`\|`STOCK`\|`VENTA`\|`COMPRA`\|`RESET_PW`),
`modulo`, `descripcion`, `ip_address`, `fecha`.

> **Quién escribe acá:** nunca el usuario. Solo el sistema, vía `log_action()` en
> `Backend/apps/audit/utils.py`, llamada desde los ViewSets. **En el diagrama, la Bitácora recibe
> flechas de casi todos los módulos.**

---

## ⭐ 2.5 CU20 — Promociones (`Backend/apps/products/models.py:152-175`)

**`Promocion`** (tabla `promocion`) — creada por `Backend/sql/006_promociones.sql`.

| Campo | Tipo | Relación / Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idpromocion`) |
| `producto` | **FK → `Producto`** | `CASCADE` — la promoción es **de un producto** |
| `porcentaje` | Decimal(5,2) | de 1.00 a 100.00 |
| `fecha_inicio` | DateField | inicio de la vigencia |
| `fecha_fin` | DateField | fin de la vigencia |
| `activo` | BooleanField | permite apagarla sin borrarla |

**Una sola tabla.** El comentario del propio modelo aclara que es **distinta del descuento VIP por
fidelidad** (que vive en `cliente.descuento_disponible`).

## ⭐ 2.6 CU21 — Venta a crédito (`Backend/apps/orders/models.py:408-515`)

**`PlanCredito`** (tabla `plan_credito`) — `Backend/sql/009_credito.sql`.

| Campo | Tipo | Relación / Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idplan`) |
| `venta` | **FK → `Venta`** | |
| `detalle` | **FK → `DetalleVenta`** | ⚠️ **el plan cuelga del ÍTEM, no de la venta** |
| `producto` | **FK → `Producto`** | |
| `cliente` | **FK → `Cliente`** | nullable |
| `usuario` | **FK → `Usuario`** | quién lo registró |
| `precio_unitario`, `cantidad`, `precio_base` | Decimal / Int | |
| `recargo_pct` | Decimal(5,2) | 20 / 25 / 30 % según el rango |
| `precio_financiado` | Decimal(12,2) | `precio_base × (1 + recargo)` |
| `inicial` | Decimal(12,2) | 20 % del financiado |
| `n_cuotas` | IntegerField | 6 / 9 / 12 |
| `monto_cuota`, `saldo` | Decimal(12,2) | |
| `estado` | CharField | `vigente` \| `pagado` \| `moroso` |
| `origen` | CharField | `walk_in` \| `al_credito_sales` |
| `numero_factura` | CharField(20) | ej. `FCR-2026-000142` |
| `fecha` | DateTimeField | |

> **El plan es POR PRODUCTO.** Si una venta lleva dos productos financiados, se generan **dos planes**.
> Esto es una decisión de diseño que hay que poder explicar.

**`Cuota`** (tabla `cuota`) — el cronograma de pagos.

| Campo | Tipo | Relación / Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idcuota`) |
| `plan` | **FK → `PlanCredito`** | `CASCADE` |
| `numero` | IntegerField | 1, 2, 3… |
| `monto` | Decimal(12,2) | |
| `mora` | Decimal(12,2) | recargo por atraso |
| `fecha_vencimiento` | DateField | |
| `fecha_pago` | DateTimeField | nullable |
| `estado` | CharField | `pendiente` \| `pagada` \| `vencida` |
| `usuario_cobro` | **FK → `Usuario`** | quién cobró |
| `stripe_payment_intent_id` | CharField(120) | pago en línea |
| `stripe_session_pending` | CharField(120) | recuperación sin webhook |
| `metodo_pago` | CharField | `efectivo` \| `stripe` |
| `numero_factura` | CharField(20) | comprobante de la cuota |

**`ChecklistCredito`** (tabla `checklist_credito`) — `Backend/sql/010_checklist_credito.sql`.
**Relación `OneToOne` con `PlanCredito`**: un checklist por plan.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | AutoField | **PK** (`idchecklist`) |
| `plan` | **OneToOne → `PlanCredito`** | `CASCADE` |
| `tipo_empleo` | CharField(20) | `dependiente` \| `independiente` |
| `antiguedad_meses` | IntegerField | |
| `ci_solicitante`, `ci_conyuge`, `factura_servicios` | Boolean | **documentos comunes** |
| `boletas_pago`, `extracto_gestora` | Boolean | **solo dependiente** |
| `facturas_ultimo_ano`, `estados_financieros`, `nit`, `croquis_domicilio`, `croquis_negocio`, `respaldos_patrimoniales` | Boolean | **solo independiente** |
| `observaciones` | TextField | |
| `fecha_verificacion` | DateTimeField | |

> El checklist **cambia según el tipo de empleo**: a un dependiente se le piden boletas de pago y el
> extracto de la gestora; a un independiente, facturas, estados financieros, NIT y croquis.

## ⭐ 2.7 CU22 — Cartera de créditos: **no tiene ninguna tabla**

Lo verifiqué en el código: **no existe ninguna tabla de cartera**. La cartera es una **agregación en
memoria** que se calcula sobre `plan_credito` y `cuota` cada vez que se la consulta
(endpoint `/planes-credito/cartera/`, `Backend/apps/orders/views.py:2051-2057`).

**Por qué está bien así:** el saldo pendiente es información **derivada**. Guardarlo en una tabla
sería duplicar un dato que ya se puede calcular sumando las cuotas impagas — y si los dos valores se
desincronizan, la base se contradice a sí misma. **En el diagrama, la Cartera es un componente de
lógica, no de datos: no le pongas una tabla debajo.**

### 2.8 Relaciones sin llave foránea declarada

⚠️ Dos columnas **funcionan como FK pero PostgreSQL no las obliga**: `compra.idproveedor` y
`venta.idcliente`. La relación existe en el modelo Django y la aplicación la respeta, pero no hay
`FOREIGN KEY` en la base.

---

## 3. Operaciones del sistema (endpoints)

Prefijo global `/api/v1/` (`Backend/config/urls.py`).

### 3.1 `/api/v1/users/` — `Backend/apps/users/urls.py`

| Ruta | Método | Qué hace | Entidad | Auth |
|---|---|---|---|---|
| `/login/` | POST | Inicia sesión, devuelve JWT | Usuario / Cliente | ❌ pública |
| `/logout/` | POST | Cierra sesión, registra en bitácora | Bitacora | ✅ |
| `/check-email/` | GET | Verifica si un email ya existe | Cliente | ❌ pública |
| `/forgot-password/` | POST | Envía código OTP por correo | *(OTP en memoria)* | ❌ pública |
| `/reset-password/` | POST | Verifica OTP y cambia la contraseña | Usuario / Cliente | ❌ pública |
| `/change-password/` | POST | Cambia contraseña estando logueado | Usuario / Cliente | ✅ |
| `/blocked-accounts/` · `/unblock-account/` | GET · POST | Cuentas bloqueadas por intentos fallidos | *(en memoria)* | ✅ admin |
| `/clientes/` | CRUD | Gestión de clientes | Cliente | registro **público**, el resto con token |
| `/` | CRUD | Gestión de usuarios internos | Usuario | ✅ **solo admin** |
| `/{id}/update_role/` | PATCH | Cambia el rol | Usuario | ✅ admin |

### 3.2 `/api/v1/products/` — `Backend/apps/products/urls.py`

| Ruta | Método | Qué hace | Entidad | Auth |
|---|---|---|---|---|
| `/` | CRUD | Catálogo de productos | Producto | **lectura pública**, escritura admin |
| `/low_stock/` | GET | Productos con stock ≤ mínimo | Producto | idem |
| `/{id}/adjust_stock/` | POST | Ajuste manual de stock | Producto + Bitacora | admin |
| `/categorias/` | CRUD | Categorías | Categoria | `AdminWriteOrReadOnly` |
| `/proveedores/` | CRUD | Proveedores | Proveedor | `AdminWriteStaffRead` — **leer exige sesión** |
| `/compras/` | CRUD | Compras a proveedor | Compra + DetalleCompra | `AdminWriteStaffRead` |
| ⭐ **`/promociones/`** | **CRUD** | **Crear, editar y dar de baja promociones** | **Promocion** | **`AdminWriteOrReadOnly`** — el catálogo público **lee** las promociones vigentes sin token; **solo el admin las crea** |

### 3.3 `/api/v1/orders/` — `Backend/apps/orders/urls.py`

**Todos los ViewSets exigen `IsAuthenticatedJWT`** salvo donde se indique.

| Ruta | Método | Qué hace | Entidad |
|---|---|---|---|
| `/ventas/` | CRUD | Ventas | Venta |
| `/ventas/{id}/confirmar_entrega/` | PATCH | Confirma la entrega | Venta |
| `/ventas/by_vendedor/` · `/ventas/historial/` | GET | Ventas y estadísticas del vendedor | Venta |
| `/ventas/{id}/pdf/` | GET | **Descarga la factura en PDF** | Factura |
| `/pagos/` | CRUD | Pagos de una venta | PagoVenta |
| `/detalles/` | GET | Ítems de venta (solo lectura) | DetalleVenta |
| `/garantias/` | CRUD + acciones | Garantías, reclamo y resolución | Garantia |
| `/resenas/` | CRUD | Reseñas y moderación | Resena |

**⭐ Mis endpoints de crédito y cartera** (`PlanCreditoViewSet`, `orders/views.py:1592+`):

| Ruta | Método | Qué hace | Entidad | Actor |
|---|---|---|---|---|
| **`/planes-credito/`** | GET / CRUD | Lista los planes de crédito | PlanCredito | admin · vendedor |
| **`/planes-credito/elegibilidad/`** | GET | **¿Este cliente puede recibir crédito?** Devuelve `bloqueado`, `cuotas_vencidas`, `activos`, `limite` | PlanCredito + Cuota | vendedor |
| **`/planes-credito/walk-in/`** | POST | **Crédito presencial.** Crea venta + detalle + plan + cuotas + pago inicial **en una sola transacción atómica** | Venta, DetalleVenta, PlanCredito, Cuota, PagoVenta | vendedor |
| **`/planes-credito/desde-venta/`** | POST | Crea el plan desde el método de pago **"Al crédito"** de `/sales` | PlanCredito + Cuota | vendedor |
| **`/planes-credito/mis-creditos/`** | GET | **Los créditos del cliente logueado**, con su cronograma | PlanCredito + Cuota | **cliente** |
| **`/planes-credito/pagar-cuota/`** | PATCH | **Cobro de cuota en efectivo.** Emite comprobante y lo manda por correo | Cuota + Factura | vendedor |
| **`/planes-credito/cartera/`** | GET | **⭐ CU22 — Cartera consolidada.** Total otorgado, cobrado, saldo, morosos y proyección | *(agregación, sin tabla)* | **admin** |

**Stripe** — `Backend/apps/orders/stripe_views.py`:

| Ruta | Método | Qué hace | Auth |
|---|---|---|---|
| `/stripe/create-checkout-session/` | POST | Abre el pago de una **venta** | ❌ `AllowAny` |
| `/stripe/confirm/` | POST | Confirma el pago y **recién ahí crea la venta** | ❌ `AllowAny` |
| ⭐ `/stripe/checkout-cuota/` | POST | **Abre el pago en línea de una cuota de crédito** | ✅ |
| ⭐ `/stripe/confirmar-cuota/` | POST | **Confirma el pago de la cuota** | ✅ |
| ⭐ `/stripe/verificar-cuota-pendiente/` | GET | **Recupera un pago de cuota sin webhook** | ✅ |

### 3.4 `/api/v1/audit/` — `Backend/apps/audit/urls.py`

| Ruta | Método | Qué hace | Auth |
|---|---|---|---|
| `/` · `/{id}/` | GET | Bitácora, con `?search=` y `?ordering=` | ✅ **solo admin** (`IsAdminRole`, `audit/views.py:27`) |

---

## 4. Reglas de negocio

### 4.1 En la base de datos — triggers de PostgreSQL

**La base de datos tiene lógica propia.** La aplicación inserta el detalle y PostgreSQL se encarga
del stock y los totales. Esto es central para el diagrama.

| Trigger | Sobre la tabla | Qué hace |
|---|---|---|
| `trigger_validar_stock` | `detalleventa` | **Rechaza la venta** si no hay stock suficiente |
| `trigger_stock_venta` | `detalleventa` | **Descuenta** `producto.stock_fisico` |
| `trigger_total_venta` | `detalleventa` | Recalcula `venta.monto_total` |
| `trigger_estado_venta` | `pagoventa` | Pasa la venta a `completed` cuando los pagos cubren el total |
| `trigger_compra_stock` | `detallecompra` | **Suma** stock al comprar a un proveedor |
| `trigger_total_compra` | `detallecompra` | Recalcula `compra.monto_total` |

**Excepción de `trigger_estado_venta`:** si `venta.pedido_online = True`, la venta **NO** se completa
sola — queda en `pending` hasta que el admin confirme la entrega (`orders/models.py:17-19`).

> ⭐ **Dato que tengo que saber defender: ni las promociones ni el crédito tienen triggers.** Toda su
> lógica —precio con descuento, recargo, cuota inicial, cronograma, mora, bloqueo del cliente— vive
> en el **backend (Python)**, no en la base de datos.

### 4.2 ⭐ Promociones — `Backend/apps/products/serializers.py:28, 43, 147-150`

**El precio con descuento NO se guarda.** `precio_promocional` es un `SerializerMethodField` que se
**calcula al leer el producto**:

1. Busca una promoción del producto con `activo = True`.
2. Compara la fecha actual contra `fecha_inicio` y `fecha_fin`.
3. Si está vigente, devuelve `precio_actual × (1 − porcentaje/100)`, redondeado a 2 decimales.
4. Si no hay promoción vigente, devuelve `None`.

**Consecuencia:** cuando la promoción expira, el precio vuelve solo a su valor normal, sin que nadie
tenga que hacer nada. **No hay ninguna tarea programada.**

### 4.3 ⭐ Venta a crédito — `Backend/apps/orders/views.py:1398-1450`

**Tarifario hardcodeado en Python** (`CREDITO_RANGOS`). **No hay tabla de parámetros.**

| Precio unitario del producto | Cuotas | Recargo |
|---|---|---|
| 1 – 5.000 Bs | 6 | 20 % |
| 5.001 – 10.000 Bs | 9 | 25 % |
| 10.001 – 15.000 Bs | 12 | 30 % |

- **Fuera de esos rangos el producto NO califica** — `calcular_credito()` devuelve `None`.
- **Cuota inicial: 20 %** del precio financiado (`CREDITO_INICIAL_PCT`).
- El **rango se decide por el precio unitario**; el financiamiento se calcula sobre el **total**
  (`precio_unitario × cantidad`).
- **La última cuota absorbe el residuo del redondeo** para que las cuotas sumen exacto el saldo
  (`views.py:1442-1444`). Detalle fino, pero demuestra rigor.
- **Numeración de facturas:** `FCR-{año}-{correlativo:06d}`, con la secuencia PostgreSQL
  `factura_credito_seq` para garantizar unicidad aunque haya inserciones en paralelo
  (`views.py:1453-1464`).
- **Atomicidad:** el endpoint walk-in crea venta + detalle + plan + cuotas + pago inicial en **una
  sola transacción**. Si algo falla, **no queda nada a medias**.

### 4.4 ⭐ Mora — `_refrescar_moras()`, `Backend/apps/orders/views.py:1549-1561`

- **`CREDITO_MORA_PCT = 10`** — recargo del **10 % sobre la cuota vencida**.
- ⚠️ **Se aplica UNA SOLA VEZ, no se acumula día a día.**
- **No hay cron ni tarea programada.** La mora se recalcula **de forma perezosa**: cuando alguien
  **lee** el plan. Por eso `_refrescar_moras()` aparece llamada en `mis_creditos`, `elegibilidad`,
  `pagar_cuota` y `cartera`.
- La misma función actualiza el estado del plan: `vigente` / `moroso` / `pagado`.

### 4.5 ⭐ Bloqueo del cliente — `views.py:1686-1703` y `1756-1765`

Un cliente **no puede recibir un crédito nuevo** si:

- tiene **al menos una cuota vencida**, **o**
- ya tiene **3 créditos activos** (estado `vigente` o `moroso`).

La API devuelve un semáforo: con **2 activos** manda `advertencia`; con **3**, **rechaza** con el
mensaje *"El cliente ya tiene N créditos activos (máximo 3). Esperar a que cancele alguno."*

### 4.6 ⭐ Cartera — `/planes-credito/cartera/`, `views.py:2051-2057`

**Agregación pura en memoria.** Recorre los planes, les refresca la mora y suma: total otorgado,
total cobrado, saldo pendiente, clientes en mora y proyección de cobranza. **No persiste nada.**

### 4.7 Otras reglas de la base compartida

- **Descuento VIP** (`Backend/sql/001_descuento_vip.sql`): cada 10.000 Bs acumulados otorgan 200 Bs
  de descuento (`cliente.total_acumulado` / `descuento_disponible`). **Es distinto de mis
  promociones** — conviene aclararlo, porque se confunden.
- **Garantías** (`orders/models.py:196-199`): nacen al crear la venta
  (`fecha_fin = fecha_venta + producto.meses_garantia`). El estado *"vencida"* **se deriva**, no se
  guarda. *(Mismo principio de diseño que mi cartera: no persistir lo que se puede calcular.)*
- **Señales de Django (`signals.py`):** ❌ **No encontrado en el código.** No existe ningún
  `signals.py` en las 4 apps. La lógica está en ViewSets, serializers y triggers.

---

## 5. Integraciones externas

| Servicio | Para qué | Dónde se invoca | Configuración |
|---|---|---|---|
| **Stripe** | Pago con tarjeta de **ventas** y ⭐ **de cuotas de crédito**. Cobra en **BOB**. Flujo **sin webhook**: el cliente paga en el Checkout hospedado y, al volver, el backend confirma la sesión. | `Backend/apps/orders/stripe_views.py` | `settings.py:281-285` — `STRIPE_SECRET_KEY`, `STRIPE_CURRENCY=bob`. Dependencia `stripe==9.12.0` |
| **Brevo** | Correos transaccionales por **API HTTP**: código OTP de recuperación y ⭐ **el comprobante de cada cuota cobrada**. | `Backend/apps/users/views.py` → `_send_brevo_email` | `settings.py:268-274` — `BREVO_API_KEY`, `BREVO_FROM_EMAIL` |
| **ReportLab** | Genera el **PDF de la factura** de venta. Es una **librería local**, no un servicio remoto. | `FacturaPDFView` → `/ventas/{id}/pdf/` | `requirements.txt:13` — `reportlab==4.0.9` |
| **Plantillas HTML** | ⭐ Facturas de crédito (la de la inicial y la de cada cuota). | `Backend/templates/` | — |

> **Excluidas de mi documento:** Google Gemini (asistente de voz) — existe en
> `Backend/apps/orders/voz_views.py` pero **no pertenece a ninguno de mis casos de uso ni a la base
> compartida**.

---

## 6. Actores del sistema

Definidos en `RolUsuario` (`Backend/apps/users/models.py:17-20`) más el `Cliente`, que es una entidad
aparte. **Cuatro actores**, aunque en mis módulos intervienen tres.

| Actor | Dónde vive | Qué hace **en mis casos de uso** ⭐ |
|---|---|---|
| **Administrador** | `Usuario.rol = 'admin'` | **Crea y da de baja las promociones** (único que puede escribir en `/promociones/`). **Consulta la cartera de créditos**: total otorgado, cobrado, saldo, morosos y proyección. Ve la bitácora. |
| **Vendedor** | `Usuario.rol = 'vendedor'` | **Registra ventas a crédito** (walk-in y método "Al crédito"), **verifica el checklist** del cliente, **consulta la elegibilidad** antes de otorgar, y **cobra las cuotas en efectivo** emitiendo el comprobante. |
| **Cliente** | Tabla `cliente` | **Ve sus créditos** y su cronograma de cuotas, **paga cuotas en línea con tarjeta**, recibe el comprobante por correo. En la tienda, **ve automáticamente el precio con descuento** de los productos en promoción. |
| **Técnico** | `Usuario.rol = 'tecnico'` | *No interviene en ninguno de mis tres casos de uso.* Existe en el sistema (base compartida). |
| *(visitante sin sesión)* | — | **Ve el catálogo con los precios promocionales aplicados**, sin necesidad de iniciar sesión (`AdminWriteOrReadOnly` permite el `GET`). |

**Autenticación:** JWT (`rest_framework_simplejwt`). Clases de permiso en
`Backend/apps/users/permissions.py`:

- `IsAuthenticatedJWT` — token válido, cualquier rol.
- `IsAdmin` — el claim `role` del JWT debe ser `admin`.
- `PublicCreateElseAuthenticated` — registro público sin token; el resto con token.
- `AdminWriteOrReadOnly` / `AdminWriteStaffRead` — en `products/views.py`.
- `IsAdminRole` — en `audit/views.py:27`.

---

## 7. Componentes para el diagrama

### Componentes

**Capa cliente (navegador — React + Vite + TypeScript)**
- `Tienda / Catálogo público` *(muestra el precio promocional)* · `Carrito` · `Panel de
  administración` · `Panel del vendedor` · `Portal del cliente`
- ⭐ `Promociones.tsx` · ⭐ `Creditos.tsx` (Registrar + Cartera) · ⭐ `MisCreditos.tsx`
- **`api.ts` — cliente HTTP** *(única frontera hacia el backend)*

**Capa de aplicación (Django REST Framework)**
- **Middleware de autenticación JWT + capa de permisos** *(transversal)*
- App **`users`** → Autenticación · Gestión de usuarios · Gestión de clientes
- App **`products`** → Catálogo · Inventario · Proveedores · Compras · ⭐ **Promociones**
- App **`orders`** → Ventas · Pagos · Facturación · Garantías · Reseñas ·
  ⭐ **Venta a crédito** · ⭐ **Cartera de cobranza** · Pasarela Stripe
- App **`audit`** → Bitácora *(transversal)*

**Capa de datos**
- **PostgreSQL** — **con lógica de negocio propia: triggers** de stock y totales.
  Tablas de la base: `usuario`, `cliente`, `categoria`, `producto`, `proveedor`, `compra`,
  `detallecompra`, `venta`, `detalleventa`, `pagoventa`, `factura`, `garantia`, `resena`, `bitacora`.
  ⭐ Tablas mías: **`promocion`**, **`plan_credito`**, **`cuota`**, **`checklist_credito`**.
- Almacenamiento de imágenes (`Backend/media/`)

**Servicios externos**
- **Stripe** (pago de ventas y ⭐ de cuotas) · **Brevo** (correos, ⭐ comprobante de cuota) ·
  **ReportLab** (PDF, librería local)

### Conexiones que no hay que olvidar

- Todo el frontend pasa **solo** por `api.ts`.
- **Todas** las peticiones cruzan el middleware JWT, salvo: login, registro de cliente, recuperación
  de contraseña, **lectura del catálogo con sus promociones** y los dos endpoints de Stripe marcados
  `AllowAny`.
- Casi todos los módulos escriben en la **Bitácora** (vía `audit/utils.py → log_action()`).
- **PostgreSQL no es un almacén pasivo**: sus triggers descuentan stock, recalculan totales y
  completan ventas. Dibujalo con un compartimiento *"Triggers"*.
- ⭐ **Cartera → NO tiene tabla.** Es un componente de lógica que **lee** `plan_credito` y `cuota` y
  agrega en memoria. **No le pongas un almacén debajo.**
- ⭐ **Venta a crédito → Stripe** (pago en línea de la cuota) y **→ Brevo** (comprobante por correo).
- ⭐ **Promociones → Catálogo:** el precio con descuento **se calcula al leer**, no se guarda.

### ⚠️ Dependencia hacia fuera de mi alcance (hay que dibujarla, pero no es mía)

Cuando se cobra una cuota, el sistema **también genera una notificación de campana** para el cliente.
Las notificaciones son un módulo **de mis compañeros**. En el diagrama va como una **flecha saliente
hacia un componente externo "Servicio de notificaciones"**, en un color atenuado. Así el diagrama no
miente sobre cómo funciona el sistema, y a la vez queda claro que no me lo adjudico.

---

## 8. Prompt listo para el navegador

*(Copiá desde acá hasta el final y pegalo en claude.ai junto con las secciones 1 a 7 de este documento.)*

> Necesito el **"Diagrama de componentes principales del sistema"** para la sección *Implementación
> de la arquitectura* de mi documentación (UML de componentes).
>
> El sistema es **Santa Cruz-Computer**, una aplicación web de gestión de inventario, ventas y
> créditos. Te paso el inventario técnico extraído del código real.
>
> **Contexto importante sobre el alcance:** el sistema es un trabajo grupal, pero **yo presento la
> plataforma base más tres módulos propios: Promociones programadas, Venta a crédito y Cartera de
> cobranza**. El diagrama debe mostrar **la base completa** y **resaltar mis tres módulos**. No
> incluyas devoluciones, servicio técnico, notificaciones ni asistente de voz: existen en el sistema,
> pero son de mis compañeros y quedan fuera de este documento.
>
> **Dibujá un diagrama de componentes UML** con cuatro capas, de arriba hacia abajo:
>
> 1. **Cliente (navegador)** — React + Vite + TypeScript. Las pantallas agrupadas por rol (tienda
>    pública, panel admin, panel vendedor, portal del cliente) y, debajo, el componente **`api.ts`**,
>    que es el **único punto de salida** hacia el backend.
> 2. **Aplicación (Django REST Framework)** — un componente por app (`users`, `products`, `orders`,
>    `audit`) con sus sub-módulos internos. Antes de ellas, un componente **"Autenticación JWT +
>    Permisos"** que intercepta todas las peticiones. **Dentro de `products` resaltá el sub-módulo
>    Promociones; dentro de `orders`, los sub-módulos Venta a crédito y Cartera de cobranza.**
> 3. **Datos** — **PostgreSQL**, con un compartimiento aparte llamado **"Triggers"**, porque la base
>    **tiene lógica de negocio propia** (valida y descuenta stock, recalcula totales, completa
>    ventas). Resaltá mis cuatro tablas: `promocion`, `plan_credito`, `cuota`, `checklist_credito`.
>    Más el almacenamiento de imágenes.
> 4. **Servicios externos** — **Stripe** (pagos con tarjeta, en BOB, tanto de ventas como de cuotas
>    de crédito) y **Brevo** (correos por API HTTP: OTP y comprobantes de cuota).
>
> **Tres precisiones que el diagrama NO debe equivocar:**
> - La **Cartera de cobranza no tiene tabla propia**: es un componente de lógica que lee
>   `plan_credito` y `cuota` y agrega en memoria. **No le dibujes un almacén debajo.**
> - El **precio promocional no se persiste**: se calcula al leer el producto. La flecha va de
>   Promociones **hacia** el Catálogo, no hacia una tabla de precios.
> - Poné una **flecha saliente atenuada** desde Venta a crédito hacia un componente externo
>   **"Servicio de notificaciones (otro integrante)"**, porque el cobro de una cuota dispara una
>   notificación que no es parte de mi alcance.
>
> **Requisitos de forma:**
> - Notación UML de componentes: rectángulos con el ícono de componente, e **interfaces
>   provistas/requeridas** (bolita y media luna) entre `api.ts` y el backend.
> - Etiquetá el protocolo en las flechas: `REST/JSON + JWT` del frontend al backend, `HTTPS` hacia
>   los servicios externos, `SQL` hacia PostgreSQL.
> - **Resaltá con un color distintivo mis tres módulos** (Promociones, Venta a crédito, Cartera) y
>   con otro color los componentes transversales (Autenticación JWT y Bitácora).
> - El diagrama tiene que **caber y leerse en una hoja A4 vertical**.
> - Español, sin abreviaturas raras.
> - Entregámelo como **artifact SVG** para poder exportarlo en alta resolución.
