# Ciclo 5 — Documento de casos de uso

> **Sistema:** Santa Cruz Computer — ventas, inventario y servicio técnico.
> **Motor de base de datos:** PostgreSQL 17. Esquema: `public`.

## Mis casos de uso

| # | Caso de uso | Actor principal | Tablas que aporta |
|---|---|---|---|
| **CU20** | Promociones programadas | Administrador | `promocion` |
| **CU21** | Venta a crédito | Vendedor / Administrador | `plan_credito`, `cuota`, `checklist_credito` |
| **CU22** | Cartera de créditos (cobranza) | Administrador | *ninguna* — es capa de reporte |

> **Nota de numeración:** en los documentos generales del proyecto estos casos figuran como
> CU24, CU28 y CU29. Aquí se renumeran a CU20, CU21 y CU22 para este entregable.

## Contenido

| # | Sección | Qué contiene |
|---|---|---|
| 1 | **Especificación de los casos de uso** | Actor, precondiciones, flujo principal, flujos alternativos, excepciones y postcondiciones |
| 2 | **Esquema de la base de datos** | Las 34 tablas, agrupadas por caso de uso, consolidadas (sin un solo `ALTER TABLE`) |
| 3 | **Diagramas de secuencia** | Uno por cada uno de mis tres casos de uso |
| 4 | **Modelo de dominio** | Mis entidades y sus cardinalidades |
| 5 | **Diagramas de estados** | Promoción · Plan de crédito · Cuota |
| 6 | **Endpoints de la API** | El contrato de cada caso de uso |
| 7 | **Reglas de negocio** | Las 22 reglas (RN-01 a RN-22) |
| 8 | **Pantallas** | Las vistas de cada caso de uso |
| 9 | **Casos de prueba** | 28 escenarios de QA |

---|---|---|
| 1 | **Esquema de la base de datos** | Las 34 tablas, agrupadas por caso de uso, consolidadas (sin un solo `ALTER TABLE`) |
| 2 | **Diagramas de secuencia** | Uno por cada uno de mis tres casos de uso |
| 3 | **Especificación de los casos de uso** | Actor, precondiciones, flujo principal, flujos alternativos, excepciones y postcondiciones |
| 4 | **Modelo de dominio** | Mis entidades y sus cardinalidades |
| 5 | **Diagramas de estados** | Promoción · Plan de crédito · Cuota |
| 6 | **Endpoints de la API** | El contrato de cada caso de uso |
| 7 | **Reglas de negocio** | Las 22 reglas (RN-01 a RN-22) |
| 8 | **Pantallas** | Las vistas de cada caso de uso |
| 9 | **Casos de prueba** | 28 escenarios de QA |

---

# 1. Especificación de los casos de uso

## 1.1 CU20 — Promociones programadas

| Campo | Detalle |
|---|---|
| **Actor principal** | Administrador |
| **Actores secundarios** | Cliente (recibe la oferta), Sistema de correo (Brevo) |
| **Objetivo** | Programar un descuento porcentual sobre un producto durante un periodo, que la tienda muestre y cobre automáticamente. |
| **Precondiciones** | El administrador está autenticado. El producto existe en el catálogo. |
| **Postcondiciones** | Mientras la promoción esté vigente, el producto se muestra y se cobra con el precio rebajado. |

**Flujo principal — Crear una promoción**

1. El administrador entra a `/promociones`.
2. El sistema lista las promociones con su estado **calculado** (vigente / programada / vencida) y un contador por estado.
3. El administrador pulsa **Nueva promoción**.
4. Selecciona el **producto**, ingresa el **porcentaje** de descuento y las fechas de **inicio** y **fin**.
5. El sistema muestra una **vista previa** del precio rebajado (`precio_actual × (1 − %/100)`).
6. El administrador confirma.
7. El sistema valida el porcentaje (1–100) y que `fecha_fin >= fecha_inicio`.
8. Inserta la fila en `promocion` y registra la acción en la **bitácora** (módulo *Promociones*).
9. La promoción aparece en la lista con su estado.

**Flujo alternativo A — Enviar las ofertas a los clientes**

1. El administrador pulsa **Enviar ofertas**.
2. El sistema recupera todas las promociones **vigentes hoy**.
3. Compone **un solo correo** con todas ellas y lo envía a cada cliente que tenga correo registrado.
4. Además inserta una **notificación** (campana) por cliente, de tipo `oferta`.
5. Informa cuántos envíos se hicieron.

**Flujo alternativo B — Editar o cancelar**

1. El administrador modifica el porcentaje o las fechas, o desactiva la promoción (`activo = false`).
2. El sistema actualiza la fila y registra la acción en la bitácora.
3. El catálogo deja de aplicar el descuento de inmediato (se evalúa en cada lectura).

**Excepciones**

| # | Condición | Respuesta del sistema |
|---|---|---|
| E1 | Porcentaje fuera de 1–100 | Rechaza: lo impide el `CHECK` de la columna |
| E2 | `fecha_fin` anterior a `fecha_inicio` | Rechaza: lo impide `chk_promo_fechas` |
| E3 | Se pulsa *Enviar ofertas* sin promociones vigentes | Error 400: "No hay promociones vigentes para enviar" |
| E4 | Un usuario no administrador intenta crear/editar | Error 403: solo lectura para roles no admin |

---

## 1.2 CU21 — Venta a crédito

| Campo | Detalle |
|---|---|
| **Actor principal** | Vendedor o Administrador |
| **Actores secundarios** | Cliente (titular del crédito), Sistema de correo (Brevo) |
| **Objetivo** | Financiar la compra de **un producto** en cuotas mensuales, entregando el producto de inmediato contra el pago de una cuota inicial. |
| **Precondiciones** | El vendedor está autenticado. El cliente está registrado. El producto tiene stock. El cliente **no está bloqueado**. |
| **Postcondiciones** | Existe un `plan_credito` vigente con su calendario de `cuota`, el stock bajó, y se emitió la factura de la inicial (`FCR-…`). |

**Flujo principal — Wizard walk-in (6 pasos)**

1. El vendedor entra a `/creditos` y abre el asistente de **venta al crédito**.
2. **Paso 1 — Cliente:** selecciona el cliente. El sistema verifica que **no esté bloqueado** (sin cuotas vencidas y con menos de 3 créditos activos).
3. **Paso 2 — Producto:** selecciona el producto y la cantidad. El sistema verifica que haya **stock suficiente** y que el precio unitario esté en el rango financiable (Bs 1–15.000).
4. **Paso 3 — Plan (automático):** el sistema calcula y muestra la simulación: tramo, recargo, precio financiado, cuota inicial, número de cuotas y monto de cada cuota.
5. **Paso 4 — Tipo de empleo:** el vendedor indica si el solicitante es **dependiente** o **independiente**.
6. **Paso 5 — Documentos:** marca el checklist de documentos que corresponde a ese tipo de empleo.
7. **Paso 6 — Antigüedad:** confirma la antigüedad laboral del solicitante.
8. El vendedor **confirma**.
9. El sistema ejecuta **una sola transacción atómica**:
   - crea la `venta` y su `detalleventa` (los **triggers** descuentan el stock y calculan el total);
   - crea el `plan_credito` con los montos calculados;
   - genera las **N cuotas** (la primera vence en 1 mes; la última absorbe el redondeo);
   - guarda el `checklist_credito`;
   - toma un correlativo de `factura_credito_seq` y arma el número **`FCR-2026-NNNNNN`**.
10. Notifica al cliente (campana + correo) y registra todo en la **bitácora** (módulo *Crédito*).
11. Devuelve el plan creado y el comprobante de la inicial, listo para imprimir.

**Flujo alternativo A — Desde una venta en `/sales`**

El vendedor elige el método de pago **"Al crédito"** durante una venta normal. El sistema crea el plan sobre el ítem correspondiente. El plan queda marcado con `origen = 'al_credito_sales'` (frente a `'walk_in'` del flujo principal).

**Excepciones**

| # | Condición | Respuesta del sistema |
|---|---|---|
| E1 | El cliente tiene **al menos una cuota vencida** | Error 400: "El cliente tiene N cuota(s) vencida(s). Regularizar antes de otorgar nuevos créditos." |
| E2 | El cliente ya tiene **3 créditos activos** | Error 400: "El cliente ya tiene N créditos activos (máximo 3)." |
| E3 | El precio unitario está **fuera de Bs 1–15.000** | Error 400: "El producto no califica a crédito." |
| E4 | **Stock insuficiente** | Error 400: "Stock insuficiente para armar el crédito." |
| E5 | `tipo_empleo` distinto de `dependiente`/`independiente` | Error 400 |
| E6 | Cliente o producto inexistente | Error 404 |

> **Nota:** al ser una transacción atómica, si **cualquier** paso del punto 9 falla, no queda nada a medias: ni venta, ni plan, ni cuotas, ni movimiento de stock.

---

## 1.3 CU22 — Cartera de créditos (cobranza)

| Campo | Detalle |
|---|---|
| **Actor principal** | Administrador |
| **Actores secundarios** | Vendedor (cobra cuotas), Cliente (paga online), Stripe |
| **Objetivo** | Dar seguimiento a todos los créditos otorgados, cobrar las cuotas y controlar la morosidad. |
| **Precondiciones** | Existe al menos un `plan_credito`. El usuario está autenticado. |
| **Postcondiciones** | Las cuotas vencidas quedan marcadas con su mora; las cobradas quedan `pagada` y el saldo del plan baja. |

**Flujo principal — Consultar la cartera**

1. El administrador entra a `/creditos`, pestaña **Cartera**.
2. El sistema **refresca las moras de forma perezosa**: recorre todas las cuotas pendientes y, si el vencimiento ya pasó, las marca `vencida` y les aplica el recargo del 10 % **una sola vez**. Ajusta el estado del plan (`moroso`, `pagado` o `vigente`).
3. Agrega en memoria: total financiado, total cobrado, por cobrar, en mora, conteo de planes por estado y la **proyección de cobros** por mes.
4. Muestra las tarjetas de resumen, la lista de planes con su barra de progreso y los clientes bloqueados.
5. El administrador puede filtrar por estado (todos / vigentes / morosos / pagados).

**Flujo alternativo A — Cobrar una cuota en efectivo**

1. El vendedor abre el plan y pulsa **Cobrar** en la cuota correspondiente.
2. El sistema marca la cuota como `pagada`, guarda la `fecha_pago` y el `idusuario_cobro`, y baja el `saldo` del plan.
3. Si **todas** las cuotas quedaron pagadas, el plan pasa a `pagado`.
4. Emite la factura de la cuota (`FCR-…`), notifica al cliente y registra en la bitácora.

**Flujo alternativo B — El cliente paga su cuota online (Stripe)**

1. El cliente entra a `/mis-creditos` y ve solo **sus** planes y su próxima cuota.
2. Pulsa **Pagar** en una cuota. El sistema crea una *CheckoutSession* de Stripe y guarda su id en `cuota.stripe_session_pending`.
3. El cliente paga en Stripe.
4. Al volver, el sistema confirma el pago y marca la cuota como `pagada` con `metodo_pago = 'stripe'`.
5. **Recuperación:** si el cliente cerró la pestaña y el pago no se confirmó, el botón **"¿Ya pagaste? Verificar"** consulta a Stripe usando `stripe_session_pending` y cierra la cuota de forma **idempotente** (no cobra ni marca dos veces).

**Excepciones**

| # | Condición | Respuesta del sistema |
|---|---|---|
| E1 | Se intenta cobrar una cuota ya `pagada` | El sistema la ignora (operación idempotente) |
| E2 | El pago en Stripe no se completó | La cuota sigue `pendiente`; queda el `stripe_session_pending` para reintentar |
| E3 | Un cliente consulta `/mis-creditos` | Solo ve sus propios planes (filtrado por el usuario autenticado) |

---

---

# 2. Esquema completo de la base de datos

## 2.1 Cómo leer este esquema

El esquema está escrito en forma **consolidada**: cada tabla aparece **una sola vez, completa**,
con sus columnas, clave primaria, llaves foráneas, `CHECK` y valores por defecto **todo dentro
del `CREATE TABLE`**. No hay ni un solo `ALTER TABLE`.

> En la base real estas tablas se construyeron en varias etapas (un volcado inicial más 13
> scripts que fueron agregando columnas), por eso el SQL original está lleno de `ALTER TABLE`.
> Aquí se muestra el **resultado final**, que es lo que sirve para dibujar el modelo.

Las tablas van **en orden de dependencia**: cada `REFERENCES` apunta a una tabla ya definida
más arriba. Se pueden ejecutar de corrido.

**Resumen: 34 tablas**

| Grupo | Casos de uso | Tablas |
|---|---|---|
| Usuarios y clientes | CU1, CU2, CU3, CU4 | 2 |
| Catálogo e inventario | CU5, CU6, CU7 | 2 |
| Compras y reabastecimiento | CU12, CU14 | 3 |
| Ventas y carrito | CU9, CU15 | 2 |
| Pagos y facturación | CU11, CU17 | 2 |
| Bitácora | CU16 | 1 |
| Garantías | CU18 | 1 |
| Reseñas | CU19 | 1 |
| Otros casos del Ciclo 5 *(de mis compañeros)* | — | 6 |
| **⭐ Promociones** | **CU20** | **1** |
| **⭐ Venta a crédito** | **CU21** | **3** |
| Infraestructura de Django | — | 10 |

## 2.2 Tipos `ENUM`

Cuatro tipos propios. Se declaran antes que las tablas porque estas los usan.

```sql
CREATE TYPE public.estado_entrega AS ENUM ('pendiente', 'entregado');

CREATE TYPE public.estado_venta AS ENUM ('pending', 'completed');

CREATE TYPE public.metodo_pago_enum AS ENUM ('qr', 'transferencia', 'efectivo', 'tarjeta');

CREATE TYPE public.estado_siat AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'ANULADO');
```

## 2.3 CU1 · CU2 · CU3 · CU4 — Usuarios, inicio de sesión, roles y permisos

Dos actores distintos: `usuario` es el **personal interno** (admin, vendedor, técnico) y
`cliente` es quien compra. El rol se guarda como texto validado por un `CHECK`.

```sql
--
-- usuario — personal interno del sistema
--
CREATE TABLE public.usuario (
    idusuario       SERIAL PRIMARY KEY,
    nombre_completo character varying(150) NOT NULL,
    username        character varying(50)  NOT NULL UNIQUE,
    password_hash   text NOT NULL,
    rol             character varying(30)  NOT NULL,
    activo          boolean DEFAULT true,
    email           character varying(100),
    telefono        character varying(20),
    ciudad          character varying(100),
    fecha_nacimiento date,
    CONSTRAINT usuario_rol_check CHECK (rol IN ('admin', 'vendedor', 'tecnico'))
);

--
-- cliente — quien compra (tienda física u online)
--
CREATE TABLE public.cliente (
    idcliente     SERIAL PRIMARY KEY,
    nombre        character varying(150) NOT NULL,
    apellido      character varying(150) NOT NULL,
    usuario_login character varying(50)  UNIQUE,
    correo        character varying(100) UNIQUE,
    password      character varying(255),
    sexo          character varying(20),
    ciudad        character varying(100),
    telefono      character varying(20),
    fecha_nacimiento date,
    nit_ci        character varying(20),
    razon_social  character varying(150),
    -- Descuento VIP por fidelidad (CU13)
    total_acumulado      numeric(12,2) NOT NULL DEFAULT 0,   -- suma historica de sus compras
    descuento_disponible numeric(10,2) NOT NULL DEFAULT 0    -- 200 Bs por cada 10.000 acumulados
);
```

## 2.4 CU5 · CU6 · CU7 — Productos, catálogo e inventario

El stock vive en `producto.stock_fisico` y lo mantienen **triggers** (§2.15), no la aplicación.

```sql
CREATE TABLE public.categoria (
    idcategoria SERIAL PRIMARY KEY,
    nombre      character varying(100) NOT NULL
);

CREATE TABLE public.producto (
    idproducto    SERIAL PRIMARY KEY,
    idcategoria   integer REFERENCES public.categoria(idcategoria),
    nombre        character varying(150) NOT NULL,
    marca         character varying(50),
    modelo        character varying(50),
    imagen_url    text,
    precio_compra numeric(10,2),
    precio_actual numeric(10,2) NOT NULL,
    stock_fisico  integer DEFAULT 0,
    stock_minimo  integer DEFAULT 0,     -- umbral de alerta (CU10)
    descripcion   text,
    meses_garantia integer NOT NULL DEFAULT 0,   -- duracion de garantia; 0 = sin garantia (CU18)
    CONSTRAINT producto_precio_actual_check CHECK (precio_actual > 0),
    CONSTRAINT producto_precio_compra_check CHECK (precio_compra >= 0),
    CONSTRAINT producto_stock_fisico_check  CHECK (stock_fisico >= 0),
    CONSTRAINT producto_stock_minimo_check  CHECK (stock_minimo >= 0)
);
```

## 2.5 CU12 · CU14 — Compras, proveedores y movimientos de stock

Una compra a proveedor **suma** stock (trigger `trigger_compra_stock`).

```sql
CREATE TABLE public.proveedor (
    idproveedor     SERIAL PRIMARY KEY,
    nombre_empresa  character varying(150) NOT NULL,
    nit             character varying(20)  NOT NULL UNIQUE,
    razon_social    character varying(150),
    contacto_nombre character varying(100),
    telefono        character varying(20),
    correo          character varying(100),
    direccion       text,
    ciudad          character varying(50),
    activo          boolean NOT NULL DEFAULT true,
    fecha_registro  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.compra (
    idcompra     SERIAL PRIMARY KEY,
    idproveedor  integer,        -- relacion logica con proveedor (ver nota al final de §2.16)
    fecha_compra timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto_total  numeric(10,2) NOT NULL DEFAULT 0    -- lo calcula un trigger
);

CREATE TABLE public.detallecompra (
    iddetallecompra SERIAL PRIMARY KEY,
    idcompra        integer REFERENCES public.compra(idcompra),
    idproducto      integer REFERENCES public.producto(idproducto),
    cantidad        integer NOT NULL,
    costo_unitario  numeric(10,2) NOT NULL,
    CONSTRAINT detallecompra_cantidad_check       CHECK (cantidad > 0),
    CONSTRAINT detallecompra_costo_unitario_check CHECK (costo_unitario >= 0)
);
```

## 2.6 CU9 · CU15 — Ventas y carrito de compras

El carrito vive en el navegador; **al confirmar** se materializa como `venta` + `detalleventa`.
El `subtotal` es una **columna generada** por Postgres: no se puede escribir a mano.

```sql
CREATE TABLE public.venta (
    idventa        SERIAL PRIMARY KEY,
    idcliente      integer,     -- relacion logica con cliente (ver nota al final de §2.16)
    idusuario      integer REFERENCES public.usuario(idusuario),   -- vendedor que la registro
    fecha_venta    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto_total    numeric(10,2) NOT NULL DEFAULT 0,               -- lo calcula un trigger
    estado         public.estado_venta   NOT NULL DEFAULT 'pending',    -- pending | completed
    estado_entrega public.estado_entrega NOT NULL DEFAULT 'pendiente',  -- pendiente | entregado
    pedido_online  boolean NOT NULL DEFAULT false,
    descuento_aplicado numeric(10,2) NOT NULL DEFAULT 0,           -- descuento VIP usado (CU13)
    -- Una venta impaga no puede figurar como entregada
    CONSTRAINT chk_entrega_pago CHECK (
        NOT (estado = 'pending' AND estado_entrega = 'entregado')
    )
);

CREATE TABLE public.detalleventa (
    iddetalle       SERIAL PRIMARY KEY,
    idventa         integer REFERENCES public.venta(idventa),
    idproducto      integer REFERENCES public.producto(idproducto),
    cantidad        integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    subtotal        numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    CONSTRAINT detalleventa_cantidad_check        CHECK (cantidad > 0),
    CONSTRAINT detalleventa_precio_unitario_check CHECK (precio_unitario >= 0)
);
```

## 2.7 CU11 · CU17 — Pagos y facturación

Una venta puede tener **varios pagos**; la factura es **una sola** (`UNIQUE` sobre `idventa`).

```sql
CREATE TABLE public.pagoventa (
    idpagoventa SERIAL PRIMARY KEY,
    idventa     integer REFERENCES public.venta(idventa),
    monto       numeric(10,2) NOT NULL,
    metodo      public.metodo_pago_enum NOT NULL,   -- qr | transferencia | efectivo | tarjeta
    fecha       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pagoventa_monto_check CHECK (monto > 0)
);

CREATE TABLE public.factura (
    idfactura     SERIAL PRIMARY KEY,
    idventa       integer UNIQUE REFERENCES public.venta(idventa),   -- 1 factura por venta
    nro_factura   bigint NOT NULL,
    cuf           character varying(100) NOT NULL,   -- codigo unico de factura (SIAT)
    cufd          character varying(100) NOT NULL,
    estado_siat   public.estado_siat DEFAULT 'PENDIENTE',
    fecha_emision timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
```

## 2.8 CU16 — Bitácora

Guarda el nombre y el rol del usuario **en texto** además de la FK: si el usuario se borra, el
registro de auditoría sigue siendo legible.

```sql
CREATE TABLE public.bitacora (
    idbitacora     SERIAL PRIMARY KEY,
    idusuario      integer REFERENCES public.usuario(idusuario),
    usuario_nombre character varying(100) NOT NULL DEFAULT '',
    usuario_rol    character varying(20)  NOT NULL DEFAULT '',
    accion         character varying(30)  NOT NULL,   -- CREATE | UPDATE | DELETE | LOGIN ...
    modulo         character varying(50)  NOT NULL,   -- Ventas | Credito | Promociones ...
    descripcion    text NOT NULL,
    ip_address     character varying(45),
    fecha          timestamp with time zone NOT NULL DEFAULT now()
);
```

## 2.9 CU18 — Garantías

Una garantía **por ítem vendido** (`UNIQUE` sobre `iddetalle`). El estado *vencida* **no se
guarda**: se calcula con `fecha_fin < hoy`.

```sql
CREATE TABLE public.garantia (
    idgarantia       SERIAL PRIMARY KEY,
    idventa          integer NOT NULL REFERENCES public.venta(idventa) ON DELETE CASCADE,
    iddetalle        integer NOT NULL UNIQUE REFERENCES public.detalleventa(iddetalle) ON DELETE CASCADE,
    idproducto       integer NOT NULL REFERENCES public.producto(idproducto),
    idcliente        integer REFERENCES public.cliente(idcliente),
    cantidad         integer NOT NULL DEFAULT 1,
    meses            integer NOT NULL DEFAULT 0,
    fecha_inicio     date NOT NULL,      -- = fecha de la venta
    fecha_fin        date NOT NULL,      -- = fecha_inicio + meses
    estado           character varying(20) NOT NULL DEFAULT 'activa',  -- activa | reclamada | aprobada | rechazada
    motivo_reclamo   text,
    fecha_reclamo    timestamp without time zone,
    resolucion       text,
    fecha_resolucion timestamp without time zone
);
```

## 2.10 CU19 — Reseñas

La reseña es **por venta completa**, no por producto. Una por venta (`UNIQUE`).

```sql
CREATE TABLE public.resena (
    idresena   SERIAL PRIMARY KEY,
    idventa    integer NOT NULL UNIQUE REFERENCES public.venta(idventa) ON DELETE CASCADE,
    idcliente  integer NOT NULL REFERENCES public.cliente(idcliente) ON DELETE CASCADE,
    puntuacion smallint NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
    comentario text,
    estado     character varying(20) NOT NULL DEFAULT 'visible',   -- visible | oculto (moderacion)
    fecha      timestamp without time zone NOT NULL DEFAULT NOW()
);
```

## 2.11 Otros casos del Ciclo 5 *(de mis compañeros)*

Se incluyen porque **mis tablas conviven con ellas** y porque el CU20 (promociones) usa
`notificacion` para enviar las ofertas.

```sql
--
-- notificacion — centro de notificaciones (campana + correo)
-- Apunta a un usuario interno O a un cliente, nunca a los dos.
--
CREATE TABLE public.notificacion (
    idnotificacion SERIAL PRIMARY KEY,
    idusuario      integer REFERENCES public.usuario(idusuario) ON DELETE CASCADE,
    idcliente      integer REFERENCES public.cliente(idcliente) ON DELETE CASCADE,
    tipo           character varying(30)  NOT NULL,   -- venta | oferta | reclamo | bienvenida ...
    titulo         character varying(150) NOT NULL,
    mensaje        text NOT NULL,
    enlace         character varying(200),            -- ruta interna a la que lleva
    canal          character varying(20) NOT NULL DEFAULT 'sistema',  -- sistema | ambos (app + correo)
    leido          boolean NOT NULL DEFAULT false,
    fecha          timestamp without time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notif_destinatario CHECK (idusuario IS NOT NULL OR idcliente IS NOT NULL)
);

--
-- devolucion — RMA. Nace ya con su decision (aprobada | rechazada).
--
CREATE TABLE public.devolucion (
    iddevolucion    SERIAL PRIMARY KEY,
    idventa         integer NOT NULL REFERENCES public.venta(idventa),
    iddetalle       integer NOT NULL REFERENCES public.detalleventa(iddetalle),
    idproducto      integer NOT NULL REFERENCES public.producto(idproducto),
    idcliente       integer REFERENCES public.cliente(idcliente),
    idusuario       integer REFERENCES public.usuario(idusuario),   -- quien la registro
    cantidad        integer NOT NULL DEFAULT 1,
    motivo          text NOT NULL,
    estado          character varying(20) NOT NULL DEFAULT 'aprobada',  -- aprobada | rechazada
    motivo_rechazo  text,
    monto_reembolso numeric(10,2) NOT NULL DEFAULT 0,
    -- Inspeccion fisica: daño o manipulacion anulan la garantia al rechazar
    insp_sin_dano         boolean NOT NULL DEFAULT false,
    insp_sin_manipulacion boolean NOT NULL DEFAULT false,
    insp_mismo_producto   boolean NOT NULL DEFAULT false,
    insp_completo         boolean NOT NULL DEFAULT false,
    fecha           timestamp without time zone NOT NULL DEFAULT NOW()
);

--
-- servicio_catalogo — los servicios tecnicos ofrecidos, con su precio
--
CREATE TABLE public.servicio_catalogo (
    idservicio SERIAL PRIMARY KEY,
    nombre     character varying(150) NOT NULL,
    tipo       character varying(20)  NOT NULL,   -- preventivo | correctivo
    equipo     character varying(20),             -- laptop | escritorio (solo preventivo)
    precio     numeric(10,2) NOT NULL DEFAULT 0,
    activo     boolean NOT NULL DEFAULT true
);

--
-- orden_servicio — una orden de servicio tecnico
--
CREATE TABLE public.orden_servicio (
    idorden               SERIAL PRIMARY KEY,
    idcliente             integer REFERENCES public.cliente(idcliente),      -- NULL si es externo
    idtecnico             integer REFERENCES public.usuario(idusuario),
    idgarantia            integer REFERENCES public.garantia(idgarantia),    -- si es preventivo gratis
    idproducto_referencia integer REFERENCES public.producto(idproducto) ON DELETE SET NULL,
    tipo                  character varying(20) NOT NULL,                    -- preventivo | correctivo
    origen                character varying(20) NOT NULL DEFAULT 'externo',  -- tienda | externo
    equipo                character varying(20) NOT NULL DEFAULT 'laptop',   -- laptop | escritorio
    equipo_descripcion    character varying(200),
    es_beneficio          boolean NOT NULL DEFAULT false,   -- consumio un uso preventivo gratis
    diagnostico           text,
    observaciones         text,
    costo_total           numeric(10,2) NOT NULL DEFAULT 0,
    estado                character varying(20) NOT NULL DEFAULT 'solicitado',
        -- solicitado | agendado | en_proceso | finalizado | entregado | cancelado
    fecha_solicitud        timestamp without time zone NOT NULL DEFAULT NOW(),
    fecha_agendada         timestamp without time zone,
    fecha_finalizacion     timestamp without time zone,
    fecha_entrega_prevista date,                          -- dia acordado de retiro
    fecha_entrega_real     timestamp without time zone    -- cuando el cliente retiro
);

--
-- orden_detalle — que servicios lleva la orden (el correctivo puede llevar varios)
--
CREATE TABLE public.orden_detalle (
    iddetorden SERIAL PRIMARY KEY,
    idorden    integer NOT NULL REFERENCES public.orden_servicio(idorden) ON DELETE CASCADE,
    idservicio integer NOT NULL REFERENCES public.servicio_catalogo(idservicio),
    precio     numeric(10,2) NOT NULL DEFAULT 0
);

--
-- tarea_servicio — checklist del mantenimiento preventivo
--
CREATE TABLE public.tarea_servicio (
    idtarea   SERIAL PRIMARY KEY,
    idorden   integer NOT NULL REFERENCES public.orden_servicio(idorden) ON DELETE CASCADE,
    tarea     character varying(150) NOT NULL,
    realizado boolean NOT NULL DEFAULT false
);
```

---

## ⭐ 2.12 CU20 — Promociones programadas

Un descuento en **porcentaje sobre UN producto**, con fecha de inicio y fin. Mientras esté
vigente, la tienda **muestra y cobra** el precio rebajado.

```sql
CREATE TABLE public.promocion (
    idpromocion  SERIAL PRIMARY KEY,
    idproducto   integer NOT NULL REFERENCES public.producto(idproducto) ON DELETE CASCADE,
    porcentaje   numeric(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
    fecha_inicio date NOT NULL,
    fecha_fin    date NOT NULL,
    activo       boolean NOT NULL DEFAULT true,
    CONSTRAINT chk_promo_fechas CHECK (fecha_fin >= fecha_inicio)
);
```

**Decisiones de diseño**

- **No hay columna de estado.** *Vigente / programada / vencida* no se guardan: se deducen
  comparando `fecha_inicio` y `fecha_fin` con la fecha de hoy. Así ninguna tarea programada
  tiene que "activar" o "expirar" promociones.
- **El precio rebajado tampoco se guarda**: se calcula al leer el producto
  (`precio_actual × (1 − porcentaje/100)`).
- Es **independiente** del descuento VIP por fidelidad (`cliente.descuento_disponible`); se
  pueden combinar en una misma venta.

---

## ⭐ 2.13 CU21 — Venta a crédito

El crédito es una **capa de financiamiento por producto** que cuelga del `detalleventa`: no
altera el stock ni los pagos de la venta original.

```sql
--
-- plan_credito — un plan de financiamiento POR PRODUCTO
--
CREATE TABLE public.plan_credito (
    idplan            SERIAL PRIMARY KEY,
    idventa           integer NOT NULL REFERENCES public.venta(idventa),
    iddetalle         integer NOT NULL REFERENCES public.detalleventa(iddetalle),
    idproducto        integer NOT NULL REFERENCES public.producto(idproducto),
    idcliente         integer REFERENCES public.cliente(idcliente),
    idusuario         integer REFERENCES public.usuario(idusuario),   -- vendedor que lo registro
    precio_unitario   numeric(12,2) NOT NULL DEFAULT 0,
    cantidad          integer NOT NULL DEFAULT 1,
    precio_base       numeric(12,2) NOT NULL DEFAULT 0,   -- precio_unitario * cantidad
    recargo_pct       numeric(5,2)  NOT NULL DEFAULT 0,   -- 20 | 25 | 30
    precio_financiado numeric(12,2) NOT NULL DEFAULT 0,   -- precio_base * (1 + recargo_pct/100)
    inicial           numeric(12,2) NOT NULL DEFAULT 0,   -- 20% del financiado
    n_cuotas          integer NOT NULL DEFAULT 6,         -- 6 | 9 | 12
    monto_cuota       numeric(12,2) NOT NULL DEFAULT 0,   -- (financiado - inicial) / n_cuotas
    saldo             numeric(12,2) NOT NULL DEFAULT 0,   -- lo que falta cobrar
    estado            character varying(20) NOT NULL DEFAULT 'vigente',  -- vigente | pagado | moroso
    origen            character varying(20),   -- walk_in | al_credito_sales
    numero_factura    character varying(20),   -- ej. FCR-2026-000142
    fecha             timestamp without time zone NOT NULL DEFAULT NOW()
);

--
-- cuota — calendario de pagos mensuales del plan
--
CREATE TABLE public.cuota (
    idcuota           SERIAL PRIMARY KEY,
    idplan            integer NOT NULL REFERENCES public.plan_credito(idplan) ON DELETE CASCADE,
    numero            integer NOT NULL,                   -- 1..n_cuotas
    monto             numeric(12,2) NOT NULL DEFAULT 0,
    mora              numeric(12,2) NOT NULL DEFAULT 0,   -- recargo si vencio
    fecha_vencimiento date NOT NULL,
    fecha_pago        timestamp without time zone,        -- NULL mientras este pendiente
    estado            character varying(20) NOT NULL DEFAULT 'pendiente',  -- pendiente | pagada | vencida
    idusuario_cobro   integer REFERENCES public.usuario(idusuario),        -- quien cobro
    -- Pago online con Stripe
    stripe_payment_intent_id character varying(120),   -- PaymentIntent de la cuota pagada
    stripe_session_pending   character varying(120),   -- CheckoutSession iniciada sin confirmar
    metodo_pago              character varying(20),    -- efectivo | stripe
    numero_factura           character varying(20)
);

--
-- checklist_credito — verificacion de documentos (1:1 con el plan)
--
CREATE TABLE public.checklist_credito (
    idchecklist      SERIAL PRIMARY KEY,
    idplan           integer NOT NULL UNIQUE REFERENCES public.plan_credito(idplan) ON DELETE CASCADE,
    tipo_empleo      character varying(20) NOT NULL,   -- dependiente | independiente
    antiguedad_meses integer NOT NULL DEFAULT 0,

    -- Documentos comunes a ambos tipos de empleo
    ci_solicitante    boolean NOT NULL DEFAULT false,
    ci_conyuge        boolean NOT NULL DEFAULT false,
    factura_servicios boolean NOT NULL DEFAULT false,   -- luz/agua (comprobante de domicilio)

    -- Solo DEPENDIENTE
    boletas_pago     boolean NOT NULL DEFAULT false,    -- 3 ultimas boletas
    extracto_gestora boolean NOT NULL DEFAULT false,    -- AFP / Gestora Publica

    -- Solo INDEPENDIENTE
    facturas_ultimo_ano     boolean NOT NULL DEFAULT false,
    estados_financieros     boolean NOT NULL DEFAULT false,
    nit                     boolean NOT NULL DEFAULT false,
    croquis_domicilio       boolean NOT NULL DEFAULT false,
    croquis_negocio         boolean NOT NULL DEFAULT false,
    respaldos_patrimoniales boolean NOT NULL DEFAULT false,   -- vehiculos, inmuebles

    observaciones      text,
    fecha_verificacion timestamp without time zone NOT NULL DEFAULT NOW()
);

--
-- factura_credito_seq — correlativo de las facturas del modulo de credito.
-- El backend lo formatea como 'FCR-{año}-{correlativo:06d}'  ->  FCR-2026-000142
--
CREATE SEQUENCE public.factura_credito_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
```

**Reglas de negocio** — el cálculo lo hace el **backend**, no la base de datos. No hay triggers
ni funciones de crédito.

| Precio unitario del producto | Cuotas | Recargo |
|---|---|---|
| Bs 1 – 5.000 | 6 | +20 % |
| Bs 5.001 – 10.000 | 9 | +25 % |
| Bs 10.001 – 15.000 | 12 | +30 % |

Fuera de ese rango el producto **no califica** a crédito.

```
precio_financiado = precio_base × (1 + recargo_pct / 100)
inicial           = 20 % del precio_financiado     (se paga al inicio; el producto se entrega ya)
saldo             = precio_financiado − inicial
monto_cuota       = saldo / n_cuotas               (la última absorbe el redondeo)
```

No hay interés mensual adicional: el recargo porcentual **ya es** la ganancia del crédito.
Una cuota que vence sin pagarse recibe **mora** y el cliente queda **bloqueado** para nuevos
créditos.

---

## ⭐ 2.14 CU22 — Cartera de créditos: por qué no tiene tablas

La cartera es una **vista de negocio, no una entidad**. Todo lo que muestra se **calcula en cada
consulta** recorriendo `plan_credito` y sus `cuota`:

| Lo que muestra la cartera | De dónde sale |
|---|---|
| Total financiado | suma de `plan_credito.precio_financiado` |
| Total cobrado | suma de las `inicial` + las cuotas `pagada` (monto + mora) |
| Por cobrar | suma de las cuotas no pagadas |
| En mora | suma de las cuotas en estado `vencida` |
| Proyección de cobros | cuotas pendientes agrupadas por mes de `fecha_vencimiento` |
| Clientes bloqueados | clientes con al menos una cuota `vencida` |
| Planes vigentes / morosos / pagados | conteo por `plan_credito.estado` |

**Consecuencia de diseño:** no existe tabla de resumen ni vista SQL materializada, y **no hay
ningún proceso programado (cron)**. El estado `vencida` de las cuotas y la mora se **refrescan
perezosamente**: se recalculan en el momento en que alguien consulta la cartera. Esto mantiene
la base simple y sin tareas de fondo, a costa de rehacer el cálculo en cada lectura.

---

## 2.15 Lógica dentro de la base de datos (funciones y triggers)

Siete funciones `plpgsql`. Mantienen el stock y los totales **automáticamente**: la aplicación
inserta el detalle y la base se encarga del resto.

| Trigger | Sobre | Qué hace |
|---|---|---|
| `trigger_validar_stock` | `detalleventa` | rechaza la venta si no hay stock suficiente |
| `trigger_stock_venta` | `detalleventa` | **descuenta** stock al vender |
| `trigger_total_venta` | `detalleventa` | recalcula `venta.monto_total` |
| `trigger_estado_venta` | `pagoventa` | pasa la venta a `completed` cuando se cubre el total |
| `trigger_compra_stock` | `detallecompra` | **suma** stock al comprar a un proveedor |
| `trigger_total_compra` | `detallecompra` | recalcula `compra.monto_total` |
| `trigger_devolucion_stock` | `devolucion` | **devuelve** stock si la devolución es `aprobada` |

> **Importante para mis casos de uso:** ni las promociones ni el crédito tienen triggers. Toda su
> lógica (precio con descuento, recargo, inicial, cuotas, mora, bloqueo del cliente) vive en el
> **backend**, no en la base de datos.

## 2.16 Dos relaciones sin llave foránea declarada

Al revisar el esquema real encontré dos columnas que **funcionan como llave foránea pero no la
tienen declarada** en la base:

| Tabla | Columna | Apunta a | Estado |
|---|---|---|---|
| `compra` | `idproveedor` | `proveedor.idproveedor` | ❌ sin `FOREIGN KEY` |
| `venta` | `idcliente` | `cliente.idcliente` | ❌ sin `FOREIGN KEY` |

La relación existe en el modelo y la aplicación la respeta, pero **la base no la obliga**: hoy se
podría insertar una venta con un `idcliente` inexistente. Al dibujar el diagrama entidad-relación
hay que representar igual estas dos relaciones (son parte del modelo); solo conviene saber que en
la implementación quedaron sin restricción.

## 2.17 Infraestructura de Django (10 tablas)

Tablas internas del framework. **No corresponden a ningún caso de uso** y se pueden **omitir del
diagrama entidad-relación** sin problema. Se listan solo para que el conteo de 34 cuadre.

```sql
CREATE TABLE public.django_content_type (
    id        SERIAL PRIMARY KEY,
    app_label character varying(100) NOT NULL,
    model     character varying(100) NOT NULL,
    UNIQUE (app_label, model)
);

CREATE TABLE public.django_migrations (
    id      BIGSERIAL PRIMARY KEY,
    app     character varying(255) NOT NULL,
    name    character varying(255) NOT NULL,
    applied timestamp with time zone NOT NULL
);

CREATE TABLE public.django_session (
    session_key  character varying(40) PRIMARY KEY,
    session_data text NOT NULL,
    expire_date  timestamp with time zone NOT NULL
);

CREATE TABLE public.auth_user (
    id           SERIAL PRIMARY KEY,
    password     character varying(128) NOT NULL,
    last_login   timestamp with time zone,
    is_superuser boolean NOT NULL,
    username     character varying(150) NOT NULL UNIQUE,
    first_name   character varying(150) NOT NULL,
    last_name    character varying(150) NOT NULL,
    email        character varying(254) NOT NULL,
    is_staff     boolean NOT NULL,
    is_active    boolean NOT NULL,
    date_joined  timestamp with time zone NOT NULL
);

CREATE TABLE public.auth_group (
    id   SERIAL PRIMARY KEY,
    name character varying(150) NOT NULL UNIQUE
);

CREATE TABLE public.auth_permission (
    id              SERIAL PRIMARY KEY,
    name            character varying(255) NOT NULL,
    content_type_id integer NOT NULL REFERENCES public.django_content_type(id),
    codename        character varying(100) NOT NULL,
    UNIQUE (content_type_id, codename)
);

CREATE TABLE public.auth_group_permissions (
    id            BIGSERIAL PRIMARY KEY,
    group_id      integer NOT NULL REFERENCES public.auth_group(id),
    permission_id integer NOT NULL REFERENCES public.auth_permission(id),
    UNIQUE (group_id, permission_id)
);

CREATE TABLE public.auth_user_groups (
    id       BIGSERIAL PRIMARY KEY,
    user_id  integer NOT NULL REFERENCES public.auth_user(id),
    group_id integer NOT NULL REFERENCES public.auth_group(id),
    UNIQUE (user_id, group_id)
);

CREATE TABLE public.auth_user_user_permissions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       integer NOT NULL REFERENCES public.auth_user(id),
    permission_id integer NOT NULL REFERENCES public.auth_permission(id),
    UNIQUE (user_id, permission_id)
);

CREATE TABLE public.django_admin_log (
    id              SERIAL PRIMARY KEY,
    action_time     timestamp with time zone NOT NULL,
    object_id       text,
    object_repr     character varying(200) NOT NULL,
    action_flag     smallint NOT NULL CHECK (action_flag >= 0),
    change_message  text NOT NULL,
    content_type_id integer REFERENCES public.django_content_type(id),
    user_id         integer NOT NULL REFERENCES public.auth_user(id)
);
```

> **Ojo:** `auth_user` (de Django) **no es** la tabla de usuarios del sistema. El personal real
> vive en `usuario` (§2.3). `auth_user` solo la usa el panel de administración interno de Django.

---

---

# 3. Diagramas de secuencia

> **Convenciones:** los bloques `alt` son ramas mutuamente excluyentes. La **Bitácora** participa
> en todo flujo que modifica datos; la **Notificación** (campana + correo) participa en todo flujo
> que avisa al cliente.

## 3.1 CU20 — Promociones programadas

```
Admin          InterfazPromos      PromocionViewSet       Promocion (BD)       Catalogo
  |                  |                      |                      |                    |
====================================================================================================
== alt [Crear promoción programada] ================================================================
  |-- fecha_ini + -->|-- create ----------->|-- validar rangos --->|                    |
  |   fecha_fin +    |                      |-- INSERT promo ------>|                   |
  |   producto +     |                      |                      |                    |
  |   % descuento    |                      |-- log CREATE_PROMO   |                    |
  |                  |<-- 201 --------------|                      |                    |
====================================================================================================
== alt [Vigencia (se evalúa al leer, no hay cron)] =================================================
  |                  |                      |-- en cada consulta   |                    |
  |                  |                      |   al catálogo:       |                    |
  |                  |                      | alt [hoy in [ini,fin] y activo]           |
  |                  |                      |    -> promo vigente  |                    |
  |                  |                      | alt [hoy < ini]  -> programada            |
  |                  |                      | alt [hoy > fin]  -> vencida               |
====================================================================================================
== alt [Aplicar en catálogo / checkout] ============================================================
  |                  |                      |-- getPrecio(producto)|                    |
  |                  |                      | alt [promo vigente]  |                    |
  |                  |                      |   precio *= (1 - %)  |                    |
  |                  |                      |-- devolver al front -------------------> |
====================================================================================================
== alt [Enviar ofertas a los clientes] =============================================================
  |-- "Enviar" ----->|-- POST /ofertas ---->|-- SELECT promos vigentes ---->|           |
  |                  |                      |-- INSERT notificacion (x cliente)         |
  |                  |                      |-- correo Brevo (broadcast)   |            |
  |                  |<-- 200 enviadas -----|                      |                    |
====================================================================================================
== alt [Editar / cancelar promo] ===================================================================
  |-- modifica ----->|-- update/destroy --->|-- UPDATE/DELETE ---->|                    |
  |                  |                      |-- log EDIT/CANCEL    |                    |
====================================================================================================
```

## 3.2 CU21 — Venta a crédito (walk-in + wizard)

```
Cliente/Vend.  InterfazCreditos    PlanCreditoVS          PlanCredito (BD)     Factura (FCR)
  |                  |                      |                      |                    |
====================================================================================================
== alt [Wizard progresivo (6 pasos)] ===============================================================
  |-- ① Cliente --->|-- valida cliente     |                      |                    |
  |-- ② Producto -->|-- valida stock       |                      |                    |
  |                  |   y rango de precio  |                      |                    |
  |-- ③ Plan (auto)->|-- calcula recargo,  |                      |                    |
  |                  |   inicial y n cuotas |                      |                    |
  |-- ④ Empleo ---->|   dependiente/indep. |                      |                    |
  |-- ⑤ Documentos->|   checklist          |                      |                    |
  |-- ⑥ Antigüedad->|   >= 12 meses        |                      |                    |
====================================================================================================
== alt [Aprobado] ==================================================================================
  |-- confirma ----->|-- POST /walkin ----->|-- validaciones ------|                    |
  |                  |                      | alt [no bloqueado por mora]               |
  |                  |                      |-- INSERT plan ------->|                   |
  |                  |                      |-- INSERT cuotas ----->|                   |
  |                  |                      |-- INSERT checklist -->|                   |
  |                  |                      |-- baja stock         |                    |
  |                  |                      |-- nextval(factura_credito_seq) ------>   |
  |                  |                      |   'FCR-2026-NNNNNN'  |                    |
  |                  |                      |-- notif + correo al cliente               |
  |                  |                      |-- log CREATE_CREDITO |                    |
  |                  |<-- 201 plan + FCR ---|                      |                    |
  |<-- toast + FCR --|                      |                      |                    |
====================================================================================================
== alt [Rechazado] =================================================================================
  |                  |                      | alt [cliente bloqueado / fuera de rango]  |
  |                  |<-- 400 motivo -------|                      |                    |
  |<-- error --------|                      |                      |                    |
====================================================================================================
```

## 3.3 CU22 — Cartera de créditos / cobranza

```
Admin          InterfazCartera     PlanCreditoVS          PlanCredito (BD)     Cuota (BD)
  |                  |                      |                      |                    |
====================================================================================================
== alt [Ver cartera] ===============================================================================
  |-- filtro estado->|-- GET /cartera ----->|-- refrescar moras -->|                    |
  |   (todos/vig/    |                      |-- SELECT planes + cuotas --------------> |
  |    moroso/pag)   |                      |-- agregar en memoria:|                    |
  |                  |                      |   financiado, cobrado,                    |
  |                  |                      |   por cobrar, en mora,                    |
  |                  |                      |   proyección por mes |                    |
  |                  |<-- resumen + lista --|                      |                    |
  |<-- cards + barra-|                      |                      |                    |
====================================================================================================
== alt [Refrescar moras (perezoso, en cada consulta)] ==============================================
  |                  |                      |-- por cada cuota pendiente:               |
  |                  |                      | alt [fecha_venc < hoy]                    |
  |                  |                      |    UPDATE estado=vencida ------------->  |
  |                  |                      |    UPDATE mora (recargo) ------------->  |
  |                  |                      |    UPDATE plan.estado=moroso ->|          |
====================================================================================================
== alt [Cobrar una cuota] ==========================================================================
  |-- "Cobrar" ----->|-- PATCH /pagar-cuota>|-- UPDATE cuota:      |                    |
  |   (efectivo)     |                      |   estado=pagada, ---------------------> |
  |                  |                      |   fecha_pago, idusuario_cobro             |
  |                  |                      |-- UPDATE plan.saldo ->|                   |
  |                  |                      | alt [todas las cuotas pagadas]            |
  |                  |                      |    UPDATE plan.estado=pagado ->|          |
  |                  |                      |-- nextval(factura_credito_seq)            |
  |                  |                      |-- notif + correo al cliente               |
  |                  |                      |-- log PAY_CUOTA      |                    |
  |                  |<-- 200 --------------|                      |                    |
====================================================================================================
== alt [El cliente paga su cuota online (Stripe)] ==================================================
  |                  |-- GET /mis-creditos->|-- solo sus planes    |                    |
  |                  |<-- planes + próxima -|                      |                    |
  |                  |-- POST checkout ---->|-- crea CheckoutSession                    |
  |                  |                      |-- guarda stripe_session_pending -------> |
  |                  |   (el cliente paga en Stripe)              |                    |
  |                  |-- "¿Ya pagaste?" --->|-- consulta a Stripe  |                    |
  |                  |                      | alt [pago confirmado]|                    |
  |                  |                      |    UPDATE cuota=pagada --------------->  |
  |                  |                      |    metodo_pago='stripe'                   |
====================================================================================================
```

---

---

# 4. Modelo de dominio

Solo las entidades de mis tres casos de uso y aquellas del núcleo con las que se relacionan.

```
                    ┌──────────────┐
                    │   CATEGORIA  │
                    └──────┬───────┘
                           │ 1
                           │
                           │ N
                    ┌──────▼───────┐          1        N  ┌──────────────┐
                    │   PRODUCTO   │───────────────────────│  PROMOCION   │  ⭐ CU20
                    └──────┬───────┘                        └──────────────┘
                           │ 1                              % descuento
                           │                                fecha_inicio / fecha_fin
                           │ N
   ┌──────────┐   1    N ┌─▼────────────┐   N    1  ┌──────────┐
   │  VENTA   │──────────│ DETALLEVENTA │           │ USUARIO  │
   └────┬─────┘          └──────┬───────┘           └────┬─────┘
        │ 1                     │ 1                      │ 1
        │                       │                        │
        │                       │ 1                      │ N
        │  N            ┌───────▼────────┐               │
        └───────────────│  PLAN_CREDITO  │◄──────────────┘   ⭐ CU21
                        └───┬────────┬───┘   registrado por
                            │ 1      │ 1
              ┌──────────┐  │        │  ┌────────────────────┐
              │ CLIENTE  │──┘        └──│ CHECKLIST_CREDITO  │  (1:1)
              └──────────┘  N           └────────────────────┘
                            │ 1
                            │
                            │ N
                     ┌──────▼───────┐
                     │    CUOTA     │   ⭐ CU21
                     └──────────────┘
                     numero, monto, mora
                     fecha_vencimiento
                     estado

  ⭐ CU22 (Cartera) NO tiene entidad propia:
     es una agregación de lectura sobre PLAN_CREDITO + CUOTA.
```

**Cardinalidades**

| Relación | Cardinalidad | Lectura |
|---|---|---|
| `producto` — `promocion` | 1 : N | Un producto puede tener varias promociones (en distintos periodos) |
| `detalleventa` — `plan_credito` | 1 : 1 | **Un plan por ítem vendido**: no se financia dos veces el mismo ítem |
| `venta` — `plan_credito` | 1 : N | Una venta con varios productos financiados genera varios planes |
| `cliente` — `plan_credito` | 1 : N | Un cliente puede tener hasta **3** créditos activos |
| `plan_credito` — `cuota` | 1 : N | El calendario: 6, 9 o 12 cuotas |
| `plan_credito` — `checklist_credito` | 1 : 1 | Un checklist de documentos por plan (`UNIQUE` sobre `idplan`) |
| `usuario` — `plan_credito` | 1 : N | El vendedor que registró el crédito |
| `usuario` — `cuota` | 1 : N | El vendedor que cobró cada cuota |

---

# 5. Diagramas de estados

## 5.1 Estado de una promoción (CU20)

El estado **no se guarda en la base**: se deriva de las fechas en cada lectura.

```
                    crear promoción
                          │
                          ▼
                 ┌─────────────────┐
                 │   PROGRAMADA    │   hoy < fecha_inicio
                 └────────┬────────┘
                          │  llega fecha_inicio
                          ▼
                 ┌─────────────────┐
                 │    VIGENTE      │   fecha_inicio <= hoy <= fecha_fin
                 │                 │   Y activo = true
                 │  → la tienda    │
                 │    aplica el %  │
                 └────┬───────┬────┘
        pasa fecha_fin│       │ el admin desactiva
                      ▼       ▼      (activo = false)
             ┌─────────────┐ ┌──────────────┐
             │   VENCIDA   │ │  INACTIVA    │
             └─────────────┘ └──────────────┘
              (no se aplica)  (no se aplica)
```

> No hay ningún proceso programado que haga estas transiciones: se evalúan al consultar.

## 5.2 Estado de un plan de crédito (CU21 / CU22)

```
              se crea el plan
              (se cobra la inicial)
                      │
                      ▼
            ┌───────────────────┐
            │     VIGENTE       │◄─────────────┐
            │                   │              │
            │  cuotas al día    │              │ se regulariza
            └─────┬───────┬─────┘              │ (paga las vencidas)
                  │       │                    │
   vence una cuota│       │ se pagan TODAS     │
   sin pagarse    │       │ las cuotas         │
                  ▼       │                    │
          ┌──────────────┐│                    │
          │   MOROSO     │┼────────────────────┘
          │              ││
          │ cliente      ││
          │ BLOQUEADO    ││
          │ para nuevos  ││
          │ créditos     ││
          └──────┬───────┘│
                 │        │
     paga todas  │        │
     las cuotas  ▼        ▼
            ┌───────────────────┐
            │     PAGADO        │   estado final
            │  saldo = 0        │
            └───────────────────┘
```

## 5.3 Estado de una cuota (CU22)

```
        se genera el calendario
                  │
                  ▼
         ┌─────────────────┐
         │   PENDIENTE     │
         │                 │
         │ mora = 0        │
         └────┬───────┬────┘
              │       │
   se paga    │       │  pasa fecha_vencimiento
   a tiempo   │       │  sin pagarse
              │       ▼
              │  ┌─────────────────┐
              │  │    VENCIDA      │
              │  │                 │
              │  │ mora = 10% del  │
              │  │ monto (una sola │
              │  │ vez)            │
              │  │                 │
              │  │ → plan: MOROSO  │
              │  │ → cliente       │
              │  │   BLOQUEADO     │
              │  └────────┬────────┘
              │           │ se paga
              ▼           ▼  (monto + mora)
         ┌─────────────────────┐
         │      PAGADA         │   estado final
         │                     │
         │ fecha_pago          │
         │ idusuario_cobro     │
         │ metodo_pago         │
         │ numero_factura      │
         └─────────────────────┘
```

> **Clave de diseño:** la transición `PENDIENTE → VENCIDA` **no la dispara un cron**. Se evalúa de forma **perezosa** cada vez que alguien lee el plan o la cartera. La mora se aplica **una sola vez** (al marcar la cuota como vencida), no se acumula día a día.

---

# 6. Endpoints de la API

## 6.1 CU20 — Promociones

Base: `/api/products/promociones/`

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET` | `/promociones/` | autenticado | Lista las promociones con su estado calculado |
| `POST` | `/promociones/` | **admin** | Crea una promoción |
| `PATCH` | `/promociones/{id}/` | **admin** | Edita porcentaje, fechas o `activo` |
| `DELETE` | `/promociones/{id}/` | **admin** | Elimina la promoción |
| `POST` | `/promociones/enviar-ofertas/` | **admin** | Envía **un** correo con las ofertas vigentes a todos los clientes + notificación en la campana |

El `ProductoSerializer` expone además, **calculados al vuelo**, los campos `promo_porcentaje` y `precio_promocional` cuando el producto tiene una promoción vigente hoy.

## 6.2 CU21 — Venta a crédito

Base: `/api/orders/planes-credito/`

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET` | `/planes-credito/simular/` | admin, vendedor | Simula el plan sin crear nada (tramo, recargo, inicial, cuotas) |
| `GET` | `/planes-credito/bloqueo/?cliente={id}` | admin, vendedor | ¿El cliente está bloqueado? Devuelve cuotas vencidas y créditos activos |
| `POST` | `/planes-credito/walk-in/` | admin, vendedor | **Crea el crédito completo** (venta + detalle + plan + cuotas + checklist + factura) en una transacción atómica |
| `POST` | `/planes-credito/desde-venta/` | admin, vendedor | Crea el plan desde una venta existente (método de pago *Al crédito*) |
| `GET` | `/planes-credito/` | admin, vendedor | Lista los planes (refresca moras al leer) |
| `GET` | `/planes-credito/{id}/` | admin, vendedor | Detalle de un plan con su calendario de cuotas |

## 6.3 CU22 — Cartera y cobranza

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET` | `/planes-credito/cartera/` | **admin** | Resumen de la cartera: financiado, cobrado, por cobrar, en mora, proyección por mes, clientes bloqueados |
| `PATCH` | `/planes-credito/pagar-cuota/` | admin, vendedor | Cobra una cuota en efectivo: la marca `pagada`, baja el saldo, emite factura y notifica |
| `GET` | `/planes-credito/mis-creditos/` | **cliente** | El cliente ve **solo sus** planes, su próxima cuota y su saldo |
| `POST` | `/stripe/checkout-cuota/` | cliente | Crea la sesión de pago de Stripe para una cuota |
| `POST` | `/stripe/confirmar-cuota/` | cliente | Confirma el pago y marca la cuota como pagada |
| `POST` | `/stripe/verificar-cuota-pendiente/` | cliente | Recupera un pago cuya pestaña se cerró (idempotente) |

---

# 7. Reglas de negocio

## CU20 — Promociones

| ID | Regla |
|---|---|
| **RN-01** | El descuento se define sobre **un producto**, no sobre una categoría. |
| **RN-02** | El porcentaje debe estar entre **1 y 100**. |
| **RN-03** | La fecha de fin **no puede ser anterior** a la de inicio. |
| **RN-04** | La promoción está **vigente** cuando `fecha_inicio <= hoy <= fecha_fin` **y** `activo = true`. Fuera de eso, no se aplica. |
| **RN-05** | Mientras esté vigente, la tienda **muestra y cobra** el precio rebajado (también en el carrito). |
| **RN-06** | El descuento por promoción es **independiente** del descuento VIP por fidelidad: se pueden combinar en una misma venta. |

## CU21 — Venta a crédito

| ID | Regla |
|---|---|
| **RN-07** | El crédito es **por producto**, según su **precio unitario**. |
| **RN-08** | Tramos: **Bs 1–5.000 → 6 cuotas (+20 %)**; **Bs 5.001–10.000 → 9 cuotas (+25 %)**; **Bs 10.001–15.000 → 12 cuotas (+30 %)**. Fuera de ese rango **no califica**. |
| **RN-09** | `precio_financiado = precio_base × (1 + recargo % / 100)`. |
| **RN-10** | La **cuota inicial es el 20 %** del precio financiado. Se paga al inicio y **el producto se entrega de inmediato**. |
| **RN-11** | `monto_cuota = (precio_financiado − inicial) / n_cuotas`. La **última cuota absorbe el redondeo**. |
| **RN-12** | **No hay interés mensual adicional**: el recargo porcentual ya es la ganancia del crédito. |
| **RN-13** | **Un plan por ítem de venta.** No se financia dos veces el mismo `detalleventa`. |
| **RN-14** | La primera cuota vence **un mes** después de la creación del plan; las siguientes, mes a mes. |
| **RN-15** | El crédito **no altera** el flujo de pagos de la venta original: es una capa aparte que cuelga del `detalleventa`. |

## CU22 — Cartera y morosidad

| ID | Regla |
|---|---|
| **RN-16** | Una cuota que **vence sin pagarse** pasa a `vencida` y recibe un recargo de **mora del 10 %** sobre su monto, **una sola vez** (no se acumula por día). |
| **RN-17** | Un plan con al menos una cuota vencida pasa a **`moroso`**. Si se regulariza, vuelve a `vigente`. |
| **RN-18** | Cuando **todas** las cuotas están pagadas, el plan pasa a **`pagado`** (estado final). |
| **RN-19** | **Bloqueo del cliente:** no se le otorgan créditos nuevos si tiene **al menos una cuota vencida**. |
| **RN-20** | **Límite de exposición:** un cliente puede tener como máximo **3 créditos activos** (`vigente` o `moroso`) a la vez. |
| **RN-21** | Las moras y los vencimientos se calculan **perezosamente al leer**. No existe ningún proceso programado (cron). |
| **RN-22** | El pago online de una cuota es **idempotente**: verificar dos veces el mismo pago no la cobra ni la marca dos veces. |

---

# 8. Pantallas

| Ruta | Rol | Caso de uso | Contenido |
|---|---|---|---|
| `/promociones` | Administrador | CU20 | Lista con contadores por estado (vigente / programada / vencida), modal de creación con **vista previa** del precio, botón **Enviar ofertas** |
| Tienda (`/store`) | Cliente | CU20 | Badge **"OFERTA −X %"**, precio tachado → rebajado, tanto en la tarjeta como en el detalle |
| `/creditos` → pestaña **Registrar** | Vendedor / Admin | CU21 | **Wizard walk-in de 6 pasos** en modal, con la simulación del plan y el checklist de documentos |
| `/creditos` → pestaña **Cartera** | Administrador | CU22 | Tarjetas de resumen, filtros con contadores, lista de planes con **barra de progreso**, proyección de cobros, botón **Cobrar** por cuota |
| `/mis-creditos` | Cliente | CU22 | Sus planes, próxima cuota, saldo, **pago con Stripe** y botón *"¿Ya pagaste? Verificar"*, comprobantes imprimibles |

---

# 9. Casos de prueba

## CU20 — Promociones

| ID | Escenario | Entrada | Resultado esperado |
|---|---|---|---|
| **P-01** | Crear promoción válida | Producto X, 20 %, hoy → hoy+7 | Se crea; el producto muestra "OFERTA −20 %" y el carrito cobra el precio rebajado |
| **P-02** | Promoción programada a futuro | Producto X, 15 %, hoy+5 → hoy+10 | Se crea con estado *programada*; **el precio NO cambia** todavía |
| **P-03** | Promoción vencida | `fecha_fin` = ayer | El producto vuelve al **precio normal** automáticamente, sin intervención |
| **P-04** | Porcentaje inválido | 150 % | Se rechaza (`CHECK` de la columna) |
| **P-05** | Fechas invertidas | inicio = hoy+5, fin = hoy | Se rechaza (`chk_promo_fechas`) |
| **P-06** | Desactivar una promo vigente | `activo = false` | El descuento deja de aplicarse **de inmediato** |
| **P-07** | Enviar ofertas sin promos vigentes | — | Error 400: "No hay promociones vigentes" |
| **P-08** | Promoción + descuento VIP | Cliente VIP compra producto en oferta | Se aplican **ambos** descuentos |

## CU21 — Venta a crédito

| ID | Escenario | Entrada | Resultado esperado |
|---|---|---|---|
| **C-01** | Crédito en el tramo bajo | Producto Bs 3.000 | 6 cuotas, +20 % → financiado Bs 3.600; inicial Bs 720; cuota Bs 480 |
| **C-02** | Crédito en el tramo alto | Producto Bs 12.000 | 12 cuotas, +30 % → financiado Bs 15.600; inicial Bs 3.120 |
| **C-03** | Producto fuera de rango | Producto Bs 20.000 | Error 400: no califica a crédito |
| **C-04** | Cliente con cuota vencida | Cliente con mora | Error 400: debe regularizar antes |
| **C-05** | Cliente con 3 créditos activos | 4.º crédito | Error 400: máximo 3 créditos activos |
| **C-06** | Sin stock | Stock = 0 | Error 400: stock insuficiente |
| **C-07** | Verificar atomicidad | Forzar un fallo al generar las cuotas | **No** queda ni venta, ni plan, ni movimiento de stock |
| **C-08** | Redondeo de la última cuota | Monto que no divide exacto | La suma de las cuotas es **exactamente** igual al saldo |
| **C-09** | Se descuenta el stock | Crédito por 1 unidad | `stock_fisico` baja en 1 (vía trigger) |
| **C-10** | Se emite la factura | Crédito aprobado | Se genera `FCR-2026-NNNNNN` y llega el correo al cliente |

## CU22 — Cartera y cobranza

| ID | Escenario | Entrada | Resultado esperado |
|---|---|---|---|
| **K-01** | Cuota que vence | Cuota con `fecha_vencimiento` = ayer | Al consultar: pasa a `vencida`, mora = 10 % del monto, plan → `moroso` |
| **K-02** | La mora **no se acumula** | Consultar la cartera 3 veces seguidas | La mora se aplica **una sola vez**, no se triplica |
| **K-03** | Cobrar una cuota | Botón *Cobrar* | Cuota → `pagada`, baja el saldo del plan, se emite factura |
| **K-04** | Cancelar el crédito | Se paga la última cuota | El plan pasa a `pagado` y el cliente se **desbloquea** |
| **K-05** | Regularizar la mora | Se paga la cuota vencida | El plan vuelve de `moroso` a `vigente` |
| **K-06** | Pago online con Stripe | El cliente paga desde `/mis-creditos` | Cuota → `pagada` con `metodo_pago = 'stripe'` |
| **K-07** | El cliente cierra la pestaña | Pago hecho, sin confirmar | *"¿Ya pagaste? Verificar"* recupera el pago y cierra la cuota |
| **K-08** | Idempotencia | Verificar dos veces el mismo pago | La cuota **no** se cobra ni se marca dos veces |
| **K-09** | Aislamiento por cliente | Cliente A consulta `/mis-creditos` | Ve **solo sus** planes, nunca los de otro cliente |
| **K-10** | Proyección de cobros | Cuotas que vencen en 3 meses distintos | El resumen las agrupa correctamente por mes |
