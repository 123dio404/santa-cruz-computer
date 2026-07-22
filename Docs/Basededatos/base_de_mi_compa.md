# Esquema de la base de datos — Documento de mi compañero

> **Qué contiene.** El esquema **limpio y correcto** para los casos de uso de mi compañero:
> la **base compartida (CU1–CU19)** más sus tres casos de uso propios del Ciclo 5:
> **Notificaciones**, **Recibo de pago + Factura por correo** y **Devoluciones (RMA)**.
>
> **Cómo está escrito.** Cada tabla aparece **una sola vez, completa** —columnas, clave primaria,
> llaves foráneas, `CHECK` y valores por defecto **todo dentro del `CREATE TABLE`**. **No hay ni un
> solo `ALTER TABLE`.** Las tablas van en **orden de dependencia**: cada `REFERENCES` apunta a una
> tabla ya definida más arriba, así que se puede ejecutar de corrido.

---

## 0. Qué tablas entran (y una aclaración importante)

| Bloque | Casos de uso | Tablas |
|---|---|---|
| Usuarios y clientes | CU1–CU4 | `usuario`, `cliente` |
| Catálogo e inventario | CU5–CU7 | `categoria`, `producto` |
| Compras y proveedores | CU12, CU14 | `proveedor`, `compra`, `detallecompra` |
| Ventas y carrito | CU9, CU15 | `venta`, `detalleventa` |
| **Pagos y facturación** | **CU11, CU17** *(= Recibo de pago + Factura por correo)* | `pagoventa`, `factura` |
| Bitácora | CU16 | `bitacora` |
| Garantías | CU18 | `garantia` |
| Reseñas | CU19 | `resena` |
| ⭐ **Notificaciones** | *(CU de mi compañero)* | `notificacion` |
| ⭐ **Devoluciones (RMA)** | *(CU de mi compañero)* | `devolucion` |

**Total: 16 tablas.**

> ⚠️ **Aclaración sobre "Recibo de pago + Factura por correo".**
> Este caso de uso **no crea ninguna tabla nueva**: trabaja sobre `pagoventa` (el pago) y `factura`
> (el comprobante), que **ya forman parte de la base compartida** (CU11 y CU17). El envío del recibo
> por correo es lógica del backend + la integración de correo (Brevo), **no una tabla**. Por eso aquí
> aparecen esas dos tablas una sola vez, en su bloque de pagos y facturación.

---

## 1. Tipos `ENUM`

Se declaran antes que las tablas porque estas los usan.

```sql
CREATE TYPE public.estado_entrega AS ENUM ('pendiente', 'entregado');

CREATE TYPE public.estado_venta AS ENUM ('pending', 'completed');

CREATE TYPE public.metodo_pago_enum AS ENUM ('qr', 'transferencia', 'efectivo', 'tarjeta');

CREATE TYPE public.estado_siat AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'ANULADO');
```

---

## 2. Base compartida (CU1 – CU19)

### 2.1 CU1 · CU2 · CU3 · CU4 — Usuarios, inicio de sesión, roles y permisos

Dos actores distintos: `usuario` es el **personal interno** (admin, vendedor, técnico) y `cliente`
es quien compra. El rol se guarda como texto validado por un `CHECK`.

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
    total_acumulado      numeric(12,2) NOT NULL DEFAULT 0,
    descuento_disponible numeric(10,2) NOT NULL DEFAULT 0
);
```

### 2.2 CU5 · CU6 · CU7 — Productos, catálogo e inventario

El stock vive en `producto.stock_fisico` y lo mantienen **triggers** (§4), no la aplicación.

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

### 2.3 CU12 · CU14 — Compras, proveedores y reabastecimiento

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
    idproveedor  integer,        -- relacion logica con proveedor (ver nota en §5)
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

### 2.4 CU9 · CU15 — Ventas y carrito de compras

El carrito vive en el navegador; **al confirmar** se materializa como `venta` + `detalleventa`.
El `subtotal` es una **columna generada** por Postgres: no se puede escribir a mano.

```sql
CREATE TABLE public.venta (
    idventa        SERIAL PRIMARY KEY,
    idcliente      integer,     -- relacion logica con cliente (ver nota en §5)
    idusuario      integer REFERENCES public.usuario(idusuario),   -- vendedor que la registro
    fecha_venta    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto_total    numeric(10,2) NOT NULL DEFAULT 0,               -- lo calcula un trigger
    estado         public.estado_venta   NOT NULL DEFAULT 'pending',    -- pending | completed
    estado_entrega public.estado_entrega NOT NULL DEFAULT 'pendiente',  -- pendiente | entregado
    pedido_online  boolean NOT NULL DEFAULT false,
    descuento_aplicado numeric(10,2) NOT NULL DEFAULT 0,           -- descuento VIP usado (CU13)
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

### 2.5 CU11 · CU17 — Pagos y facturación  *(= Recibo de pago + Factura por correo)*

Una venta puede tener **varios pagos**; la factura es **una sola** (`UNIQUE` sobre `idventa`).
Estas son las tablas sobre las que trabaja el caso de uso **Recibo de pago + Factura por correo**:
el recibo se arma con los datos de `pagoventa` y la factura con `factura`, y se envían por correo.

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

### 2.6 CU16 — Bitácora

Guarda el nombre y el rol del usuario **en texto** además de la FK: si el usuario se borra, el
registro de auditoría sigue siendo legible.

```sql
CREATE TABLE public.bitacora (
    idbitacora     SERIAL PRIMARY KEY,
    idusuario      integer REFERENCES public.usuario(idusuario),
    usuario_nombre character varying(100) NOT NULL DEFAULT '',
    usuario_rol    character varying(20)  NOT NULL DEFAULT '',
    accion         character varying(30)  NOT NULL,   -- CREATE | UPDATE | DELETE | LOGIN ...
    modulo         character varying(50)  NOT NULL,
    descripcion    text NOT NULL,
    ip_address     character varying(45),
    fecha          timestamp with time zone NOT NULL DEFAULT now()
);
```

### 2.7 CU18 — Garantías

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

### 2.8 CU19 — Reseñas

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

---

## 3. Casos de uso propios de mi compañero (Ciclo 5)

### ⭐ 3.1 Notificaciones — `notificacion`

Centro de notificaciones (campana + correo). Apunta a **un usuario interno O a un cliente, nunca a
los dos** — eso lo garantiza el `CHECK` final. Si `canal = 'ambos'`, además del aviso en la campana
se envía un correo.

```sql
CREATE TABLE public.notificacion (
    idnotificacion SERIAL PRIMARY KEY,
    idusuario      integer REFERENCES public.usuario(idusuario) ON DELETE CASCADE,
    idcliente      integer REFERENCES public.cliente(idcliente) ON DELETE CASCADE,
    tipo           character varying(30)  NOT NULL,   -- venta | reclamo | reclamo_resuelto | bienvenida ...
    titulo         character varying(150) NOT NULL,
    mensaje        text NOT NULL,
    enlace         character varying(200),            -- ruta interna a la que lleva (ej. /warranties)
    canal          character varying(20) NOT NULL DEFAULT 'sistema',  -- sistema | ambos (app + correo)
    leido          boolean NOT NULL DEFAULT false,
    fecha          timestamp without time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notif_destinatario CHECK (idusuario IS NOT NULL OR idcliente IS NOT NULL)
);
```

### ⭐ 3.2 Devoluciones (RMA) — `devolucion`

Una devolución nace **ya con su decisión** (`aprobada` | `rechazada`). El stock del producto vuelve
—por trigger (§4)— **solo si es `aprobada`**. Los cuatro campos de inspección física sirven para
decidir si un rechazo también anula la garantía (por daño o manipulación). **No toca** `detalleventa`,
`factura` ni `pagoventa`: es un registro aparte.

```sql
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
```

---

## 4. Lógica dentro de la base de datos (triggers)

Funciones `plpgsql` que mantienen el stock y los totales **automáticamente**: la aplicación inserta
el detalle y la base se encarga del resto. De todas ellas, la que pertenece a un caso de uso de mi
compañero es la última (`trigger_devolucion_stock`).

| Trigger | Sobre | Qué hace |
|---|---|---|
| `trigger_validar_stock` | `detalleventa` | rechaza la venta si no hay stock suficiente |
| `trigger_stock_venta` | `detalleventa` | **descuenta** stock al vender |
| `trigger_total_venta` | `detalleventa` | recalcula `venta.monto_total` |
| `trigger_estado_venta` | `pagoventa` | pasa la venta a `completed` cuando se cubre el total |
| `trigger_compra_stock` | `detallecompra` | **suma** stock al comprar a un proveedor |
| `trigger_total_compra` | `detallecompra` | recalcula `compra.monto_total` |
| ⭐ `trigger_devolucion_stock` | `devolucion` | **devuelve** el stock solo si la devolución es `aprobada` |

> **Ni las notificaciones tienen trigger.** Se generan desde el backend cuando ocurre el evento
> (una venta, un reclamo resuelto, una bienvenida). La única de estas tres tablas con lógica en la
> base es `devolucion`.

---

## 5. Nota — dos relaciones sin llave foránea declarada

Al revisar el esquema real hay dos columnas que **funcionan como llave foránea pero no la tienen
declarada** en la base:

| Tabla | Columna | Apunta a | Estado |
|---|---|---|---|
| `compra` | `idproveedor` | `proveedor.idproveedor` | ❌ sin `FOREIGN KEY` |
| `venta` | `idcliente` | `cliente.idcliente` | ❌ sin `FOREIGN KEY` |

La relación existe en el modelo y la aplicación la respeta, pero **la base no la obliga**. Al dibujar
el diagrama entidad-relación hay que representar igual estas dos relaciones (son parte del modelo);
solo conviene saber que en la implementación quedaron sin restricción.

---

## 6. Diagramas de secuencia

Uno por cada uno de los tres casos de uso de mi compañero. Están escritos en texto (formato de
"vida de los objetos") tal como salen del comportamiento real del sistema; sirven como guía para
dibujarlos en el navegador o en la herramienta UML.

### ⭐ 6.1 Notificaciones (sistema + correo)

Una notificación siempre aparece en la **campana**; si el evento se marca con `canal = 'ambos'`,
además se envía por **correo** (Brevo). El cliente/usuario la ve al hacer *polling* y, al abrirla,
se marca como leída y navega al enlace.

```
Sistema/Ctrl   NotifHelper         Notificacion (BD)      Brevo (correo)       Usuario/Campana
  |                  |                      |                      |                    |
====================================================================================================
== alt [Evento — canal='sistema'] ==================================================================
  |-- crear_notif -->|-- INSERT notif ----->|                      |                    |
  |   (user, tipo,   |<-- ok ---------------|                      |                    |
  |    titulo, msg,  |                      |                      |                    |
  |    enlace)       |                      |                      |                    |
====================================================================================================
== alt [Evento — canal='ambos'] ====================================================================
  |-- crear_notif -->|-- INSERT notif ----->|                      |                    |
  |                  |-- render HTML brand -|                      |                    |
  |                  |-- enviar correo ------------------------->  |                    |
  |                  |<-- ok --------------------------------------|                    |
====================================================================================================
== alt [Polling / campana] =========================================================================
  |                  |                      |                      |-- cada 30s ------->|
  |                  |                      |<-- GET /notif ------ |                    |
  |                  |                      |-- SELECT no_leidas -->                    |
  |                  |                      |<-- lista + count -----                    |
  |                  |                      |                      |<-- badge + lista --|
====================================================================================================
== alt [Abrir notificación] ========================================================================
  |                  |                      |                      |-- click item ----->|
  |                  |                      |<-- POST marcar-leida-|                    |
  |                  |                      |-- UPDATE leido=T --->|                    |
  |                  |                      |                      |-- navega a enlace->|
  |                  |                      |                      | alt [no autenticado]
  |                  |                      |                      |    → /login?next=  |
====================================================================================================
== alt [Marcar todas] ==============================================================================
  |                  |                      |<-- POST marcar-leidas todas --------------|
  |                  |                      |-- UPDATE leido=T (all)                    |
====================================================================================================
```

### ⭐ 6.2 Recibo de pago + Factura por correo

Dos momentos distintos: el **recibo** se genera y se manda por correo **apenas se paga** (tras el
pago con Stripe); la **factura fiscal** se genera **al entregar** el producto. Se puede reenviar
cualquiera de los dos.

```
Cliente        StripeController    VentaViewSet           ReciboFactura(gen)   Brevo
  |                  |                      |                      |                    |
====================================================================================================
== alt [Recibo tras pago Stripe] ===================================================================
  |-- vuelve OK ---->|-- payment-success -->|-- crear venta ------>|                    |
  |                  |                      |-- generar RECIBO --->|                    |
  |                  |                      |   (interno, PDF)     |                    |
  |                  |                      |-- enviar correo --------------------->    |
  |                  |                      |   'Recibo Bs X'      |                    |
  |<-- correo recibo-|                      |                      |                    |
====================================================================================================
== alt [Factura al entregar] =======================================================================
  |-- llega a ------>|-- vendedor entrega ->|-- PATCH estado=entregado                  |
  |   retirar        |                      |-- generar FACTURA -->|                    |
  |                  |                      |   (SIN/NIT + QR fiscal)                   |
  |                  |                      |-- adjuntar PDF ---------------------->     |
  |                  |                      |-- enviar correo --------------------->     |
  |<-- correo fact --|                      |                      |                    |
====================================================================================================
== alt [Reenviar recibo/factura] ===================================================================
  |-- pide reenvío ->|-- POST /reenviar --->|-- SELECT documento --|                    |
  |                  |                      |-- enviar correo --------------------->     |
====================================================================================================
```

### ⭐ 6.3 Devoluciones (RMA)

La devolución **nace ya con su decisión**: `aprobada` o `rechazada`. Solo si es `aprobada` el
trigger devuelve el stock. En ambos casos se avisa al cliente y se registra en la bitácora.

```
Cliente        Vendedor/Admin      DevolucionViewSet      Devolucion (BD)      TriggerStock
  |                  |                      |                      |                    |
  |-- lleva prod --->|                      |                      |                    |
  |   a tienda       |                      |                      |                    |
====================================================================================================
== alt [Aprobada en mostrador] =====================================================================
  |                  |-- abre modal ------->|-- validar venta ---->|                    |
  |                  |   venta+prod+motivo  |<-- venta existe -----|                    |
  |                  |                      | alt [fuera plazo] 409|                    |
  |                  |                      |-- INSERT devolucion->|                    |
  |                  |                      |   estado=aprobada    |                    |
  |                  |                      |                      |-- trigger sube ---->|
  |                  |                      |                      |   stock            |
  |                  |                      |-- registra reembolso |                    |
  |                  |                      |-- notif cliente      |                    |
  |                  |                      |-- log RMA_APPROVED   |                    |
  |                  |<-- 201 rma ----------|                      |                    |
====================================================================================================
== alt [Rechazada en mostrador] ====================================================================
  |                  |-- registra rechazo ->|-- INSERT devolucion->|                    |
  |                  |   con motivo         |   estado=rechazada   |                    |
  |                  |                      |-- notif cliente      |                    |
  |                  |                      |-- log RMA_REJECTED   |                    |
  |                  |<-- 201 rma ----------|                      |                    |
====================================================================================================
== alt [Historial / reporte devoluciones] ==========================================================
  |                  |-- filtros ---------->|-- list(?rango,cli,   |                    |
  |                  |                      |         estado)      |                    |
  |                  |                      |-- SELECT ------------|                    |
  |                  |<-- lista + total ----|<-- filas ------------|                    |
====================================================================================================
```

> **Para dibujarlos en el navegador:** cada bloque `== alt [...] ==` es un fragmento alternativo del
> diagrama (un escenario). En UML se representa con un marco **`alt`** que agrupa esas interacciones.
> Los `====` son solo separadores visuales, no forman parte del diagrama.
