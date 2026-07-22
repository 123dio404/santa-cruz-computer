# Prompts para generar los diagramas en Claude (navegador)

> **Cómo usar esto:** copia el bloque completo de cada prompt (todo lo que está dentro del
> recuadro) y pégalo en una conversación nueva de claude.ai. Cada prompt es **autocontenido**:
> lleva dentro el SQL y las reglas que Claude necesita, porque allá no tiene acceso al repo.
>
> **Consejo:** usa **una conversación por diagrama**. Si metes los 5 en el mismo chat, se le
> mezcla el contexto y empeoran los resultados.
>
> **Mis casos de uso:** CU20 Promociones · CU21 Venta a crédito · CU22 Cartera de créditos.

---

## Prompt 1 — Diagrama Entidad-Relación (ER)

Es el más importante. Muestra tus 4 tablas y las del núcleo con las que se relacionan.

```
Necesito un diagrama entidad-relación (ER) para un proyecto universitario de bases de datos.
Es un sistema de ventas de computadoras en Bolivia (PostgreSQL 17).

Genera el diagrama como un artifact interactivo (HTML+SVG), con notación de patas de gallo
(crow's foot) para las cardinalidades. Que se vea limpio y sea legible para imprimir.

IMPORTANTE — resalta visualmente (con otro color) las 4 tablas que son MÍAS:
promocion, plan_credito, cuota, checklist_credito.
Las demás son del núcleo del sistema y van en color neutro: son contexto.

Este es el esquema real:

-- ===== TABLAS DEL NÚCLEO (contexto, color neutro) =====

CREATE TABLE categoria (
    idcategoria SERIAL PRIMARY KEY,
    nombre      varchar(100) NOT NULL
);

CREATE TABLE producto (
    idproducto     SERIAL PRIMARY KEY,
    idcategoria    integer REFERENCES categoria(idcategoria),
    nombre         varchar(150) NOT NULL,
    marca          varchar(50),
    modelo         varchar(50),
    precio_actual  numeric(10,2) NOT NULL,
    stock_fisico   integer DEFAULT 0,
    stock_minimo   integer DEFAULT 0,
    meses_garantia integer NOT NULL DEFAULT 0
);

CREATE TABLE cliente (
    idcliente            SERIAL PRIMARY KEY,
    nombre               varchar(150) NOT NULL,
    apellido             varchar(150) NOT NULL,
    correo               varchar(100) UNIQUE,
    nit_ci               varchar(20),
    total_acumulado      numeric(12,2) NOT NULL DEFAULT 0,
    descuento_disponible numeric(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE usuario (
    idusuario       SERIAL PRIMARY KEY,
    nombre_completo varchar(150) NOT NULL,
    username        varchar(50) NOT NULL UNIQUE,
    rol             varchar(30) NOT NULL CHECK (rol IN ('admin','vendedor','tecnico')),
    activo          boolean DEFAULT true
);

CREATE TABLE venta (
    idventa            SERIAL PRIMARY KEY,
    idcliente          integer,   -- relación con cliente (SIN foreign key declarada)
    idusuario          integer REFERENCES usuario(idusuario),
    fecha_venta        timestamp DEFAULT CURRENT_TIMESTAMP,
    monto_total        numeric(10,2) NOT NULL DEFAULT 0,
    estado             varchar(20) NOT NULL DEFAULT 'pending',
    descuento_aplicado numeric(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE detalleventa (
    iddetalle       SERIAL PRIMARY KEY,
    idventa         integer REFERENCES venta(idventa),
    idproducto      integer REFERENCES producto(idproducto),
    cantidad        integer NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    subtotal        numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

-- ===== MIS TABLAS (resaltar con otro color) =====

-- CU20 — Promociones programadas
CREATE TABLE promocion (
    idpromocion  SERIAL PRIMARY KEY,
    idproducto   integer NOT NULL REFERENCES producto(idproducto) ON DELETE CASCADE,
    porcentaje   numeric(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),
    fecha_inicio date NOT NULL,
    fecha_fin    date NOT NULL,
    activo       boolean NOT NULL DEFAULT true,
    CONSTRAINT chk_promo_fechas CHECK (fecha_fin >= fecha_inicio)
);

-- CU21 — Venta a crédito
CREATE TABLE plan_credito (
    idplan            SERIAL PRIMARY KEY,
    idventa           integer NOT NULL REFERENCES venta(idventa),
    iddetalle         integer NOT NULL REFERENCES detalleventa(iddetalle),
    idproducto        integer NOT NULL REFERENCES producto(idproducto),
    idcliente         integer REFERENCES cliente(idcliente),
    idusuario         integer REFERENCES usuario(idusuario),
    precio_unitario   numeric(12,2) NOT NULL DEFAULT 0,
    cantidad          integer NOT NULL DEFAULT 1,
    precio_base       numeric(12,2) NOT NULL DEFAULT 0,
    recargo_pct       numeric(5,2)  NOT NULL DEFAULT 0,
    precio_financiado numeric(12,2) NOT NULL DEFAULT 0,
    inicial           numeric(12,2) NOT NULL DEFAULT 0,
    n_cuotas          integer NOT NULL DEFAULT 6,
    monto_cuota       numeric(12,2) NOT NULL DEFAULT 0,
    saldo             numeric(12,2) NOT NULL DEFAULT 0,
    estado            varchar(20) NOT NULL DEFAULT 'vigente',
    origen            varchar(20),
    numero_factura    varchar(20),
    fecha             timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE cuota (
    idcuota           SERIAL PRIMARY KEY,
    idplan            integer NOT NULL REFERENCES plan_credito(idplan) ON DELETE CASCADE,
    numero            integer NOT NULL,
    monto             numeric(12,2) NOT NULL DEFAULT 0,
    mora              numeric(12,2) NOT NULL DEFAULT 0,
    fecha_vencimiento date NOT NULL,
    fecha_pago        timestamp,
    estado            varchar(20) NOT NULL DEFAULT 'pendiente',
    idusuario_cobro   integer REFERENCES usuario(idusuario),
    metodo_pago       varchar(20),
    numero_factura    varchar(20)
);

CREATE TABLE checklist_credito (
    idchecklist      SERIAL PRIMARY KEY,
    idplan           integer NOT NULL UNIQUE REFERENCES plan_credito(idplan) ON DELETE CASCADE,
    tipo_empleo      varchar(20) NOT NULL,
    antiguedad_meses integer NOT NULL DEFAULT 0,
    ci_solicitante   boolean NOT NULL DEFAULT false,
    ci_conyuge       boolean NOT NULL DEFAULT false,
    factura_servicios boolean NOT NULL DEFAULT false,
    boletas_pago     boolean NOT NULL DEFAULT false,
    extracto_gestora boolean NOT NULL DEFAULT false,
    facturas_ultimo_ano boolean NOT NULL DEFAULT false,
    estados_financieros boolean NOT NULL DEFAULT false,
    nit                 boolean NOT NULL DEFAULT false,
    croquis_domicilio   boolean NOT NULL DEFAULT false,
    croquis_negocio     boolean NOT NULL DEFAULT false,
    respaldos_patrimoniales boolean NOT NULL DEFAULT false,
    observaciones      text,
    fecha_verificacion timestamp NOT NULL DEFAULT NOW()
);

NOTAS que deben verse reflejadas en el diagrama:
1. detalleventa → plan_credito es 1:1 (un plan por ítem vendido; no se financia dos veces
   el mismo ítem). NO lo dibujes como 1:N.
2. plan_credito → checklist_credito es 1:1 (hay UNIQUE sobre idplan).
3. plan_credito → cuota es 1:N (6, 9 o 12 cuotas).
4. producto → promocion es 1:N (un producto puede tener promociones en distintos periodos).
5. venta.idcliente NO tiene foreign key declarada en la base real, pero la relación existe
   en el modelo. Dibújala con línea PUNTEADA y una nota que lo aclare.

Después del diagrama, dame una lista breve de las cardinalidades por si tengo que
justificarlas en la defensa.
```

---

## Prompt 2 — Diagrama de casos de uso (UML)

```
Necesito un diagrama de casos de uso UML para un proyecto universitario.
Sistema: tienda de computadoras "Santa Cruz Computer" (Bolivia).

Genera el diagrama como un artifact (HTML+SVG), con la notación UML estándar:
actores como monigotes, casos de uso como óvalos dentro del límite del sistema,
y las relaciones <<include>> / <<extend>> con línea punteada y flecha.

ACTORES:
- Administrador
- Vendedor
- Cliente
- Sistema de Correo (actor secundario / externo)
- Stripe (actor secundario / externo, pasarela de pago)

MIS 3 CASOS DE USO (son los que van dentro del límite del sistema):

CU20 — Gestionar promociones programadas
  Actor: Administrador
  El admin define un descuento en % sobre un producto, con fecha de inicio y fin.
  Mientras está vigente, la tienda muestra y cobra el precio rebajado.
  Sub-casos:
    - Crear promoción
    - Editar / cancelar promoción
    - Enviar ofertas a los clientes   <<extend>>  (opcional; dispara correo + notificación)

CU21 — Registrar venta a crédito
  Actores: Vendedor, Administrador
  Financia UN producto en cuotas mensuales. El cliente paga una inicial del 20% y se
  lleva el producto de inmediato.
  <<include>> Verificar elegibilidad del cliente   (obligatorio: sin cuotas vencidas
                                                    y máximo 3 créditos activos)
  <<include>> Verificar checklist de documentos    (obligatorio, según tipo de empleo)
  <<include>> Generar calendario de cuotas         (obligatorio)
  <<include>> Emitir factura de la inicial         (obligatorio, correlativo FCR-AAAA-NNNNNN)

CU22 — Gestionar cartera de créditos
  Actores: Administrador (principal), Cliente (consulta sus créditos)
  Seguimiento de todos los créditos otorgados, cobranza y control de morosidad.
  Sub-casos:
    - Consultar cartera (resumen, proyección de cobros, clientes bloqueados)
    - Cobrar cuota en efectivo
    - Consultar "Mis créditos"          (actor: Cliente)
    - Pagar cuota online                (actor: Cliente + Stripe)  <<extend>>
  <<include>> Calcular mora de cuotas vencidas    (obligatorio: se recalcula en cada consulta)

RELACIONES CON ACTORES EXTERNOS:
- El "Sistema de Correo" participa en: Enviar ofertas (CU20), Registrar venta a crédito
  (CU21, avisa al cliente), Cobrar cuota (CU22, manda el comprobante).
- "Stripe" participa solo en: Pagar cuota online (CU22).

Nota: el sistema completo tiene más casos de uso (ventas, inventario, garantías, servicio
técnico...), pero esos son de mis compañeros. Dibuja SOLO estos 3 y sus sub-casos.
```

---

## Prompt 3 — Diagrama de clases / modelo de dominio

```
Necesito un diagrama de clases UML (modelo de dominio) para un proyecto universitario.
Sistema de venta de computadoras con financiamiento en cuotas.

Genera el diagrama como un artifact (HTML+SVG), notación UML: cajas con
nombre / atributos / métodos, y las cardinalidades en los extremos de cada asociación.

Resalta con otro color MIS clases: Promocion, PlanCredito, Cuota, ChecklistCredito.
Las demás son contexto.

CLASES DEL NÚCLEO (contexto):

Producto
  - idProducto: int
  - nombre: string
  - marca: string
  - precioActual: decimal
  - stockFisico: int
  + getPrecioConDescuento(): decimal     // aplica la promoción vigente, si hay

Cliente
  - idCliente: int
  - nombre: string
  - apellido: string
  - correo: string
  - totalAcumulado: decimal
  - descuentoDisponible: decimal
  + estaBloqueado(): boolean             // tiene cuotas vencidas o 3 créditos activos

Usuario
  - idUsuario: int
  - nombreCompleto: string
  - rol: enum {admin, vendedor, tecnico}

Venta
  - idVenta: int
  - fechaVenta: datetime
  - montoTotal: decimal
  - estado: enum {pending, completed}

DetalleVenta
  - idDetalle: int
  - cantidad: int
  - precioUnitario: decimal
  - subtotal: decimal      // calculado

MIS CLASES (resaltar):

Promocion                                     // CU20
  - idPromocion: int
  - porcentaje: decimal          // 1 a 100
  - fechaInicio: date
  - fechaFin: date
  - activo: boolean
  + estaVigente(): boolean       // fechaInicio <= hoy <= fechaFin AND activo
  + getEstado(): enum {programada, vigente, vencida, inactiva}   // CALCULADO, no se guarda
  + aplicarA(precio: decimal): decimal

PlanCredito                                   // CU21
  - idPlan: int
  - precioUnitario: decimal
  - cantidad: int
  - precioBase: decimal
  - recargoPct: decimal          // 20 | 25 | 30
  - precioFinanciado: decimal
  - inicial: decimal             // 20% del financiado
  - nCuotas: int                 // 6 | 9 | 12
  - montoCuota: decimal
  - saldo: decimal
  - estado: enum {vigente, moroso, pagado}
  - origen: enum {walk_in, al_credito_sales}
  - numeroFactura: string        // FCR-2026-000142
  + calcularPlan(precio: decimal): void     // determina tramo, recargo, inicial y cuotas
  + generarCuotas(): void
  + refrescarMoras(): void       // marca vencidas y recalcula el estado (perezoso)

Cuota                                         // CU21 / CU22
  - idCuota: int
  - numero: int
  - monto: decimal
  - mora: decimal                // 10% del monto, una sola vez
  - fechaVencimiento: date
  - fechaPago: datetime
  - estado: enum {pendiente, pagada, vencida}
  - metodoPago: enum {efectivo, stripe}
  + estaVencida(): boolean
  + pagar(usuario: Usuario): void

ChecklistCredito                              // CU21
  - idChecklist: int
  - tipoEmpleo: enum {dependiente, independiente}
  - antiguedadMeses: int
  - ciSolicitante: boolean
  - ciConyuge: boolean
  - facturaServicios: boolean
  - boletasPago: boolean            // solo dependiente
  - extractoGestora: boolean        // solo dependiente
  - facturasUltimoAno: boolean      // solo independiente
  - estadosFinancieros: boolean     // solo independiente
  - nit: boolean                    // solo independiente
  - croquisDomicilio: boolean       // solo independiente
  - croquisNegocio: boolean         // solo independiente
  - respaldosPatrimoniales: boolean // solo independiente
  + estaCompleto(): boolean         // valida según el tipo de empleo

ASOCIACIONES (respeta estas cardinalidades):
  Producto  1 ──── 0..* Promocion
  Venta     1 ──── 1..* DetalleVenta
  DetalleVenta 1 ──── 0..1 PlanCredito     // 1:1 — un plan por ítem, NO 1:N
  Cliente   1 ──── 0..3 PlanCredito        // máximo 3 créditos activos
  Usuario   1 ──── 0..* PlanCredito        // el vendedor que lo registró
  PlanCredito 1 ──── 1 ChecklistCredito    // composición (si se borra el plan, se borra)
  PlanCredito 1 ──── 6..12 Cuota           // composición
  Usuario   1 ──── 0..* Cuota              // quien cobró la cuota

NOTA IMPORTANTE que debe aparecer en el diagrama:
"La Cartera de créditos (CU22) NO es una clase: es una vista de agregación en tiempo de
lectura sobre PlanCredito y Cuota. No persiste."
```

---

## Prompt 4 — Diagramas de estados

```
Necesito 3 diagramas de estados UML para un proyecto universitario.
Sistema de venta de computadoras con financiamiento en cuotas (Bolivia).

Genera los 3 en un solo artifact (HTML+SVG), uno debajo del otro, con notación UML:
estado inicial (círculo negro), estados como rectángulos redondeados, transiciones con
flecha y etiqueta [condición] / acción, y estado final (círculo con anillo).

=== DIAGRAMA 1: Estado de una PROMOCIÓN (CU20) ===

Dato clave: el estado NO se guarda en la base de datos. Se DERIVA de las fechas cada vez
que alguien consulta. No hay ningún proceso programado (cron) que haga las transiciones.

Estados y transiciones:
- [inicial] --crear promoción--> PROGRAMADA        (cuando hoy < fecha_inicio)
- PROGRAMADA --[llega fecha_inicio]--> VIGENTE
- [inicial] --crear promoción--> VIGENTE           (si hoy ya está dentro del rango)
- VIGENTE: la tienda aplica el % de descuento al precio del producto
- VIGENTE --[hoy > fecha_fin]--> VENCIDA           (estado final)
- VIGENTE --[el admin pone activo = false]--> INACTIVA
- INACTIVA --[el admin pone activo = true]--> VIGENTE   (si sigue dentro del rango de fechas)

Agrega una nota: "El estado es calculado, no persistido. No existe un cron."

=== DIAGRAMA 2: Estado de un PLAN DE CRÉDITO (CU21/CU22) ===

Estados y transiciones:
- [inicial] --se crea el plan y se cobra la cuota inicial--> VIGENTE
- VIGENTE --[vence una cuota sin pagarse]--> MOROSO
- MOROSO --[el cliente paga las cuotas vencidas]--> VIGENTE     (se regulariza)
- VIGENTE --[se pagan TODAS las cuotas]--> PAGADO               (estado final)
- MOROSO --[se pagan TODAS las cuotas]--> PAGADO                (estado final)

En el estado MOROSO agrega esta nota: "El cliente queda BLOQUEADO: no se le otorgan
créditos nuevos hasta que regularice."
En PAGADO: "saldo = 0. El cliente se desbloquea."

=== DIAGRAMA 3: Estado de una CUOTA (CU22) ===

Estados y transiciones:
- [inicial] --se genera el calendario del plan--> PENDIENTE     (mora = 0)
- PENDIENTE --[se paga antes del vencimiento]--> PAGADA         (estado final)
- PENDIENTE --[pasa fecha_vencimiento sin pagarse]--> VENCIDA
- VENCIDA --[se paga el monto + la mora]--> PAGADA              (estado final)

En VENCIDA agrega esta nota: "Se aplica una mora del 10% sobre el monto, UNA SOLA VEZ
(no se acumula día a día). El plan pasa a MOROSO y el cliente queda bloqueado."
En PAGADA: "Se guarda fecha_pago, quién cobró, método de pago (efectivo | stripe) y el
número de factura."

Nota general para los 3 diagramas: "Las transiciones por vencimiento NO las dispara un
proceso programado. Se evalúan de forma perezosa cada vez que se consulta el plan o la
cartera."
```

---

## Prompt 5 — Diagramas de secuencia (UML)

```
Necesito 3 diagramas de secuencia UML para un proyecto universitario.
Sistema de venta de computadoras (Django + React + PostgreSQL).

Genera los 3 en un solo artifact (HTML+SVG), con notación UML estándar: participantes
arriba, líneas de vida punteadas, barras de activación, flechas sólidas para las llamadas
y punteadas para las respuestas, y bloques "alt" / "loop" con su marco y etiqueta.

=== DIAGRAMA 1: CU20 — Crear promoción y enviar ofertas ===

Participantes: Administrador | InterfazPromociones | PromocionViewSet | BD_Promocion |
               BD_Notificacion | ServicioCorreo(Brevo)

Flujo:
1. Administrador -> InterfazPromociones: selecciona producto, %, fecha_inicio, fecha_fin
2. InterfazPromociones -> InterfazPromociones: muestra vista previa del precio rebajado
3. Administrador -> InterfazPromociones: confirma
4. InterfazPromociones -> PromocionViewSet: POST /promociones/
5. PromocionViewSet -> PromocionViewSet: valida (1 <= % <= 100, fecha_fin >= fecha_inicio)
6. alt [datos válidos]
     PromocionViewSet -> BD_Promocion: INSERT promocion
     PromocionViewSet -> BD_Promocion: registra en bitácora
     PromocionViewSet --> InterfazPromociones: 201 Created
     InterfazPromociones --> Administrador: promoción creada
   else [datos inválidos]
     PromocionViewSet --> InterfazPromociones: 400 Bad Request
     InterfazPromociones --> Administrador: muestra el error
7. (flujo alternativo, marcarlo como bloque "opt")
   Administrador -> InterfazPromociones: pulsa "Enviar ofertas"
   InterfazPromociones -> PromocionViewSet: POST /promociones/enviar-ofertas/
   PromocionViewSet -> BD_Promocion: SELECT promociones vigentes hoy
   alt [hay promociones vigentes]
     loop [por cada cliente con correo]
       PromocionViewSet -> BD_Notificacion: INSERT notificacion (tipo='oferta')
       PromocionViewSet -> ServicioCorreo: enviar correo con las ofertas
     end
     PromocionViewSet --> Administrador: N ofertas enviadas
   else [no hay vigentes]
     PromocionViewSet --> Administrador: 400 "No hay promociones vigentes"

=== DIAGRAMA 2: CU21 — Venta a crédito (wizard walk-in) ===

Participantes: Vendedor | WizardCreditos | PlanCreditoViewSet | BD (venta, detalleventa,
               plan_credito, cuota, checklist_credito) | Triggers | ServicioCorreo

Flujo:
1. Vendedor -> WizardCreditos: [Paso 1] selecciona cliente
2. WizardCreditos -> PlanCreditoViewSet: GET /planes-credito/bloqueo/?cliente=X
3. PlanCreditoViewSet -> BD: cuenta cuotas vencidas y créditos activos del cliente
4. PlanCreditoViewSet --> WizardCreditos: {bloqueado: false}
5. Vendedor -> WizardCreditos: [Paso 2] selecciona producto y cantidad
6. WizardCreditos -> PlanCreditoViewSet: GET /planes-credito/simular/
7. PlanCreditoViewSet -> PlanCreditoViewSet: determina el tramo según el precio unitario
      (Bs 1-5.000 -> 6 cuotas +20% | Bs 5.001-10.000 -> 9 cuotas +25% |
       Bs 10.001-15.000 -> 12 cuotas +30%)
8. PlanCreditoViewSet --> WizardCreditos: [Paso 3] simulación (financiado, inicial, cuotas)
9. Vendedor -> WizardCreditos: [Paso 4] tipo de empleo (dependiente | independiente)
10. Vendedor -> WizardCreditos: [Paso 5] marca el checklist de documentos
11. Vendedor -> WizardCreditos: [Paso 6] confirma la antigüedad laboral
12. Vendedor -> WizardCreditos: CONFIRMA
13. WizardCreditos -> PlanCreditoViewSet: POST /planes-credito/walk-in/
14. alt [validaciones OK: no bloqueado, hay stock, precio en rango]
      Marca este bloque como TRANSACCIÓN ATÓMICA (dibuja un marco alrededor):
        PlanCreditoViewSet -> BD: INSERT venta
        PlanCreditoViewSet -> BD: INSERT detalleventa
        BD -> Triggers: se disparan
        Triggers -> BD: descuentan stock y recalculan monto_total
        PlanCreditoViewSet -> BD: INSERT plan_credito
        loop [por cada una de las N cuotas]
          PlanCreditoViewSet -> BD: INSERT cuota (vence en el mes N)
        end
        PlanCreditoViewSet -> BD: INSERT checklist_credito
        PlanCreditoViewSet -> BD: nextval(factura_credito_seq) -> 'FCR-2026-NNNNNN'
      PlanCreditoViewSet -> ServicioCorreo: correo al cliente con la factura de la inicial
      PlanCreditoViewSet -> BD: registra en bitácora
      PlanCreditoViewSet --> WizardCreditos: 201 {plan, cuotas, factura}
      WizardCreditos --> Vendedor: crédito aprobado + comprobante
    else [cliente con cuotas vencidas]
      PlanCreditoViewSet --> Vendedor: 400 "Tiene N cuotas vencidas, regularizar primero"
    else [ya tiene 3 créditos activos]
      PlanCreditoViewSet --> Vendedor: 400 "Máximo 3 créditos activos"
    else [precio fuera de Bs 1-15.000]
      PlanCreditoViewSet --> Vendedor: 400 "El producto no califica a crédito"
    else [stock insuficiente]
      PlanCreditoViewSet --> Vendedor: 400 "Stock insuficiente"

Agrega una nota sobre el bloque atómico: "Si CUALQUIER paso falla, se revierte todo:
no queda ni venta, ni plan, ni cuotas, ni movimiento de stock."

=== DIAGRAMA 3: CU22 — Cartera: consultar y cobrar ===

Participantes: Administrador | InterfazCartera | PlanCreditoViewSet | BD_PlanCredito |
               BD_Cuota | ServicioCorreo

Flujo:
1. Administrador -> InterfazCartera: abre la pestaña Cartera
2. InterfazCartera -> PlanCreditoViewSet: GET /planes-credito/cartera/
3. PlanCreditoViewSet -> BD_PlanCredito: SELECT todos los planes con sus cuotas
4. Marca este bloque como "REFRESCO PEREZOSO DE MORAS" (dibújalo con un marco):
     loop [por cada cuota pendiente]
       alt [fecha_vencimiento < hoy]
         PlanCreditoViewSet -> BD_Cuota: UPDATE estado = 'vencida'
         PlanCreditoViewSet -> BD_Cuota: UPDATE mora = 10% del monto (UNA SOLA VEZ)
         PlanCreditoViewSet -> BD_PlanCredito: UPDATE plan.estado = 'moroso'
       end
     end
5. PlanCreditoViewSet -> PlanCreditoViewSet: agrega en memoria (total financiado, cobrado,
      por cobrar, en mora, proyección de cobros por mes, clientes bloqueados)
6. PlanCreditoViewSet --> InterfazCartera: resumen + lista de planes
7. InterfazCartera --> Administrador: tarjetas + barra de progreso por plan

8. (cobro de una cuota, bloque aparte)
   Administrador -> InterfazCartera: pulsa "Cobrar" en una cuota
   InterfazCartera -> PlanCreditoViewSet: PATCH /planes-credito/pagar-cuota/
   PlanCreditoViewSet -> BD_Cuota: UPDATE estado='pagada', fecha_pago, idusuario_cobro
   PlanCreditoViewSet -> BD_PlanCredito: UPDATE saldo = saldo - monto
   alt [todas las cuotas del plan están pagadas]
     PlanCreditoViewSet -> BD_PlanCredito: UPDATE estado = 'pagado'
   end
   PlanCreditoViewSet -> BD_Cuota: nextval(factura_credito_seq) -> número de factura
   PlanCreditoViewSet -> ServicioCorreo: comprobante al cliente
   PlanCreditoViewSet --> Administrador: 200 OK

Agrega una nota: "El refresco de moras NO lo dispara un cron: ocurre de forma perezosa
cada vez que se consulta la cartera."
```

---

## Después de generar cada diagrama

Cuando el Claude del navegador te dé un diagrama que te guste:

1. **Exporta la imagen** (o guarda el artifact).
2. **Pásame el resultado** y lo integro al `Documento_ciclo5.md`, reemplazando el ASCII.

Si algún diagrama sale mal, dime **qué** salió mal y ajusto el prompt.
