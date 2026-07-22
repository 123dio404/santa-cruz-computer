CREATE TYPE public.estado_entrega AS ENUM ('pendiente', 'entregado');

CREATE TYPE public.estado_venta AS ENUM ('pending', 'completed');

CREATE TYPE public.metodo_pago_enum AS ENUM ('qr', 'transferencia', 'efectivo', 'tarjeta');

CREATE TYPE public.estado_siat AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'ANULADO');

CREATE TABLE public.usuario (
    idusuario        SERIAL PRIMARY KEY,
    nombre_completo  character varying(150) NOT NULL,
    username         character varying(50)  NOT NULL UNIQUE,
    password_hash    text NOT NULL,
    rol              character varying(30)  NOT NULL,
    activo           boolean DEFAULT true,
    email            character varying(100),
    telefono         character varying(20),
    ciudad           character varying(100),
    fecha_nacimiento date,
    CONSTRAINT usuario_rol_check CHECK (rol IN ('admin', 'vendedor', 'tecnico'))
);

CREATE TABLE public.cliente (
    idcliente            SERIAL PRIMARY KEY,
    nombre               character varying(150) NOT NULL,
    apellido             character varying(150) NOT NULL,
    usuario_login        character varying(50)  UNIQUE,
    correo               character varying(100) UNIQUE,
    password             character varying(255),
    sexo                 character varying(20),
    ciudad               character varying(100),
    telefono             character varying(20),
    fecha_nacimiento     date,
    nit_ci               character varying(20),
    razon_social         character varying(150),
    total_acumulado      numeric(12,2) NOT NULL DEFAULT 0,
    descuento_disponible numeric(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE public.categoria (
    idcategoria SERIAL PRIMARY KEY,
    nombre      character varying(100) NOT NULL
);

CREATE TABLE public.producto (
    idproducto     SERIAL PRIMARY KEY,
    idcategoria    integer REFERENCES public.categoria(idcategoria),
    nombre         character varying(150) NOT NULL,
    marca          character varying(50),
    modelo         character varying(50),
    imagen_url     text,
    precio_compra  numeric(10,2),
    precio_actual  numeric(10,2) NOT NULL,
    stock_fisico   integer DEFAULT 0,
    stock_minimo   integer DEFAULT 0,
    descripcion    text,
    meses_garantia integer NOT NULL DEFAULT 0,
    CONSTRAINT producto_precio_actual_check CHECK (precio_actual > 0),
    CONSTRAINT producto_precio_compra_check CHECK (precio_compra >= 0),
    CONSTRAINT producto_stock_fisico_check  CHECK (stock_fisico >= 0),
    CONSTRAINT producto_stock_minimo_check  CHECK (stock_minimo >= 0)
);

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
    idproveedor  integer,
    fecha_compra timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto_total  numeric(10,2) NOT NULL DEFAULT 0
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

CREATE TABLE public.venta (
    idventa            SERIAL PRIMARY KEY,
    idcliente          integer,
    idusuario          integer REFERENCES public.usuario(idusuario),
    fecha_venta        timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    monto_total        numeric(10,2) NOT NULL DEFAULT 0,
    estado             public.estado_venta   NOT NULL DEFAULT 'pending',
    estado_entrega     public.estado_entrega NOT NULL DEFAULT 'pendiente',
    pedido_online      boolean NOT NULL DEFAULT false,
    descuento_aplicado numeric(10,2) NOT NULL DEFAULT 0,
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

CREATE TABLE public.pagoventa (
    idpagoventa SERIAL PRIMARY KEY,
    idventa     integer REFERENCES public.venta(idventa),
    monto       numeric(10,2) NOT NULL,
    metodo      public.metodo_pago_enum NOT NULL,
    fecha       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pagoventa_monto_check CHECK (monto > 0)
);

CREATE TABLE public.factura (
    idfactura     SERIAL PRIMARY KEY,
    idventa       integer UNIQUE REFERENCES public.venta(idventa),
    nro_factura   bigint NOT NULL,
    cuf           character varying(100) NOT NULL,
    cufd          character varying(100) NOT NULL,
    estado_siat   public.estado_siat DEFAULT 'PENDIENTE',
    fecha_emision timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.bitacora (
    idbitacora     SERIAL PRIMARY KEY,
    idusuario      integer REFERENCES public.usuario(idusuario),
    usuario_nombre character varying(100) NOT NULL DEFAULT '',
    usuario_rol    character varying(20)  NOT NULL DEFAULT '',
    accion         character varying(30)  NOT NULL,
    modulo         character varying(50)  NOT NULL,
    descripcion    text NOT NULL,
    ip_address     character varying(45),
    fecha          timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.garantia (
    idgarantia       SERIAL PRIMARY KEY,
    idventa          integer NOT NULL REFERENCES public.venta(idventa) ON DELETE CASCADE,
    iddetalle        integer NOT NULL UNIQUE REFERENCES public.detalleventa(iddetalle) ON DELETE CASCADE,
    idproducto       integer NOT NULL REFERENCES public.producto(idproducto),
    idcliente        integer REFERENCES public.cliente(idcliente),
    cantidad         integer NOT NULL DEFAULT 1,
    meses            integer NOT NULL DEFAULT 0,
    fecha_inicio     date NOT NULL,
    fecha_fin        date NOT NULL,
    estado           character varying(20) NOT NULL DEFAULT 'activa',
    motivo_reclamo   text,
    fecha_reclamo    timestamp without time zone,
    resolucion       text,
    fecha_resolucion timestamp without time zone
);

CREATE TABLE public.resena (
    idresena   SERIAL PRIMARY KEY,
    idventa    integer NOT NULL UNIQUE REFERENCES public.venta(idventa) ON DELETE CASCADE,
    idcliente  integer NOT NULL REFERENCES public.cliente(idcliente) ON DELETE CASCADE,
    puntuacion smallint NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
    comentario text,
    estado     character varying(20) NOT NULL DEFAULT 'visible',
    fecha      timestamp without time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notificacion (
    idnotificacion SERIAL PRIMARY KEY,
    idusuario      integer REFERENCES public.usuario(idusuario) ON DELETE CASCADE,
    idcliente      integer REFERENCES public.cliente(idcliente) ON DELETE CASCADE,
    tipo           character varying(30)  NOT NULL,
    titulo         character varying(150) NOT NULL,
    mensaje        text NOT NULL,
    enlace         character varying(200),
    canal          character varying(20) NOT NULL DEFAULT 'sistema',
    leido          boolean NOT NULL DEFAULT false,
    fecha          timestamp without time zone NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notif_destinatario CHECK (idusuario IS NOT NULL OR idcliente IS NOT NULL)
);

CREATE TABLE public.devolucion (
    iddevolucion          SERIAL PRIMARY KEY,
    idventa               integer NOT NULL REFERENCES public.venta(idventa),
    iddetalle             integer NOT NULL REFERENCES public.detalleventa(iddetalle),
    idproducto            integer NOT NULL REFERENCES public.producto(idproducto),
    idcliente             integer REFERENCES public.cliente(idcliente),
    idusuario             integer REFERENCES public.usuario(idusuario),
    cantidad              integer NOT NULL DEFAULT 1,
    motivo                text NOT NULL,
    estado                character varying(20) NOT NULL DEFAULT 'aprobada',
    motivo_rechazo        text,
    monto_reembolso       numeric(10,2) NOT NULL DEFAULT 0,
    insp_sin_dano         boolean NOT NULL DEFAULT false,
    insp_sin_manipulacion boolean NOT NULL DEFAULT false,
    insp_mismo_producto   boolean NOT NULL DEFAULT false,
    insp_completo         boolean NOT NULL DEFAULT false,
    fecha                 timestamp without time zone NOT NULL DEFAULT NOW()
);
