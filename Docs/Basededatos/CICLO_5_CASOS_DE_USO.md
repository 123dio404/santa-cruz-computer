# Ciclo 5 — Casos de Uso (CU20 a CU29)

> Documento **vivo**: se actualiza cada vez que se avanza un caso de uso.
> Explica qué hace cada CU, su flujo y su estado de implementación.

## Resumen y estado

| ID | Caso de Uso | Actores | Estado |
|----|-------------|---------|--------|
| CU20 | Chatbot de atención (IA) | Cliente | ⬜ Pendiente (va al final) |
| CU21 | Notificaciones (sistema + correo) | Todos | ✅ Completado |
| CU22 | Recibo de pago + Factura por correo | Cliente | ✅ Completado |
| CU23 | Devoluciones (RMA) | Vendedor/Admin | ✅ Completado |
| CU24 | Promociones programadas | Admin | ✅ Completado |
| CU25 | Servicio preventivo | Cliente/Técnico | ✅ Completado |
| CU26 | Servicio correctivo | Cliente/Técnico | ✅ Completado |
| CU27 | Ficha/historial de mantenimiento | Técnico/Cliente | ✅ Completado |
| CU28 | Venta a crédito | Cliente/Vendedor/Admin | ✅ Completado |
| CU29 | Cartera de créditos / cobranza | Admin | ✅ Completado |

Roles del sistema: **Administrador · Vendedor · Cliente · Técnico** (Técnico es nuevo en el Ciclo 5).

---

# CU21 — Notificaciones (sistema + correo) ✅ COMPLETADO

## Descripción
Centro de notificaciones **persistente** (guardado en BD) con leído/no leído e historial, para **todos** los usuarios (incluido el cliente, que antes no tenía). Las importantes hacia el cliente también se envían por **correo (Brevo)**. Reemplaza la campana anterior, que solo mostraba conteos en vivo para admin/vendedor.

## Diferencia con lo anterior
- **Antes:** campana con números en vivo (stock bajo, pedidos, reclamos), solo admin/vendedor, sin historial.
- **Ahora:** bandeja de eventos concretos, con leído/no leído, para cada usuario, y con correo en los importantes.

## Actores
- **Cliente:** recibe notificaciones de lo suyo (reclamos, bienvenida, invitación a reseña).
- **Admin/Vendedor:** reciben notificaciones internas + siguen viendo sus alertas en vivo.

## Modelo de datos
Tabla `notificacion` (`Backend/sql/004_notificaciones.sql`):
`idusuario` (o) `idcliente`, `tipo`, `titulo`, `mensaje`, `enlace` (ruta interna), `canal` (`sistema` | `ambos`), `leido`, `fecha`.

## Flujo
1. Ocurre un evento (nueva venta, reclamo creado/resuelto, registro, entrega…).
2. El backend llama al helper `crear_notificacion(...)` → guarda la fila; si `canal='ambos'`, además envía el correo por Brevo.
3. El frontend (campana) consulta cada 30 s: muestra las notificaciones y el contador de no leídas.
4. El usuario abre una notificación → se marca leída y navega a su `enlace`.
5. Si el destino es una página protegida y no hay sesión, el login recuerda el destino (`?next=`) y lo devuelve ahí tras autenticar.

## Correos al cliente (con HTML de marca)
- 👋 **Bienvenida** al registrarse.
- 📩 **Reclamo recibido** (acuse).
- 🛡️ **Reclamo resuelto**.
- ⭐ **Invitación a reseña** al entregar la compra.
- Internos (solo campana, sin correo): nueva venta, reclamo creado→admin, reseña nueva→admin.

## Endpoints
- `GET /api/v1/users/notificaciones/` → mis notificaciones + no leídas.
- `POST /api/v1/users/notificaciones/marcar-leidas/` → marca una (`{id}`) o todas (`{todas:true}`).

## Estado de implementación (pasos)
- ✅ **1. SQL** tabla `notificacion` (aplicada en Railway).
- ✅ **2. Modelo** `Notificacion` (`managed=False`).
- ✅ **3. Helper** `crear_notificacion()` + endpoints.
- ✅ **4. Redirect after login** (`?next=`).
- ✅ **5. Campana** conectada a la BD, visible para todos (clientes incluidos).
- ✅ **6. Eventos enganchados + 4 correos** con HTML de marca y `FRONTEND_URL`:
  - Registro de cliente → **Bienvenida** (correo + campana).
  - Reclamo de garantía creado → **Reclamo recibido** al cliente (correo + campana).
  - Reclamo aprobado/rechazado → **Reclamo resuelto** al cliente (correo + campana).
  - Entrega de venta confirmada → **Invitación a reseña** al cliente (correo + campana).
  - Nueva reseña → aviso a los **administradores** (solo campana).

Commits: `15c08ea4` (backend), `db34b974` (redirect), `344ac07d` (campana), + eventos/correos.

---

# CU22 — Recibo de pago + Factura por correo ✅ COMPLETADO

Flujo de **2 documentos** para dar coherencia al pago online (recojo en tienda):

**1. Recibo de pago (al pagar con Stripe):**
- Cuando el cliente paga (`ConfirmCheckoutView` crea la venta *pendiente*), se le envía un **recibo de pago** por correo (plantilla de marca con logo, detalle de productos, total, aviso "pendiente de entrega").
- Además se **muestra en pantalla** en `PaymentSuccess.tsx` (recibo con logo + tabla + total + botones).

**2. Factura (al completar la entrega):**
- Cuando un vendedor/admin **confirma la entrega** (o registra una venta en tienda ya completada), se envía la **factura en PDF adjunta** (ReportLab).
- `FacturaPDFView.construir_pdf(venta)` es un `staticmethod` reutilizado por la descarga y por el correo.

Detalles técnicos: `_send_brevo_email` soporta **adjunto** (base64). `_email_html` lleva el **logo** (`FRONTEND_URL/logo.png`, con texto de respaldo si el correo bloquea imágenes). `enviar_factura_por_correo(venta)` y `_enviar_recibo_pago(venta)` nunca rompen el flujo si el correo falla.
Commits: `d8a2f755` (factura), + recibo de pago (stripe + PaymentSuccess).

# CU23 — Devoluciones (RMA) ✅ COMPLETADO
El vendedor/admin registra una devolución desde **Historial de Ventas** (pestaña Clientes → botón "Registrar devolución"). Nace `aprobada` o `rechazada`.
- **Parámetros:** ≤ 7 días desde la venta, la venta existe, no devuelto antes (cantidad disponible), inspección física OK. `DIAS_DEVOLUCION = 7`.
- **Trigger `AFTER INSERT`** reingresa stock SOLO si `aprobada` (una vez). Al aprobar, **anula la garantía** del ítem. NUNCA toca `detalleventa`/`factura`/`pagoventa`.
- **Reporte de ventas** (Excel/PDF): las líneas devueltas salen como **"Devuelta"** + resumen bruto − devoluciones = **ventas netas**.
- **Dashboard:** tarjeta **"Ingresos Netos"** = ingresos − devoluciones aprobadas.
- **Reporte de devoluciones** propio (Excel/PDF, color ámbar) con total reembolsado.
- Tabla `devolucion` (SQL 005). Modelo/endpoints en `orders`. NO se notifica al cliente (está en el mostrador).
Commits: 2bc875b1 (backend), d0fb2735 (UI), 79212ba8 (reportes/dashboard), + reporte de devoluciones.

# CU24 — Promociones programadas ✅ COMPLETADO
El admin define un descuento **% por producto** (no por categoría) con `fecha_inicio`/`fecha_fin`. Mientras esté vigente, la tienda **muestra y cobra** el precio rebajado.
- **Página `/promociones`** (admin, en el menú): lista con estado vigente/programada/vencida + modal crear (producto + %, fechas) con **vista previa** del precio.
- **Tabla `promocion`** (SQL 006). Modelo/endpoints en `products`. El `ProductoSerializer` expone `promo_porcentaje` y `precio_promocional` cuando hay promo vigente hoy.
- **Tienda:** badge **"OFERTA −X%"** + precio ~~normal~~ → rebajado (card y detalle). `addToCart` usa el precio promocional → el carrito/venta cobran el descuento real.
- **Combina** con el descuento VIP (independientes). Distinto del VIP por fidelidad.
- **Enviar ofertas a clientes** (botón admin): un solo correo con las promos vigentes a todos los clientes con correo + notificación en campana. **Reutiliza y EXTIENDE CU21** (primer envío broadcast/masivo, tipo 'oferta').
Commits: 25f39076 (backend), e1c17abc (página admin), 36d617ce (tienda+carrito), + enviar-ofertas.

# Servicio Técnico (CU25 · CU26 · CU27) ✅ COMPLETADO
Nuevo **rol Técnico** (4º actor). El técnico **registra Y ejecuta** todas las órdenes (clientes de tienda + externos). SQL `007_servicios_tecnicos.sql` (servicio_catalogo + orden_servicio + orden_detalle + tarea_servicio). Modelos/endpoints en `orders`.

**CU25 — Preventivo:** todo-en-uno (HW+SW), con checklist. Precio por equipo: **laptop 200**, **escritorio 250**. **GRATIS** solo laptops de la tienda con garantía vigente (2 usos, 6 meses). El sistema muestra los usos disponibles (endpoint `elegibilidad`).

**CU26 — Correctivo:** catálogo fijo (virus 100, formateo 150, recuperación 300/450/1000), cualquier equipo, se pueden sumar varios.

**Órdenes:** estados solicitado→agendado→en_proceso→finalizado/cancelado (página **Mis Trabajos** del técnico: registrar + lista + detalle + checklist). Al **finalizar** avisa al cliente (CU21 "tu equipo está listo"). Todo en bitácora (módulo "Servicio Técnico").

**CU27 — Ficha/historial:** el cliente ve su historial de servicios en **Mis Pedidos** (sección "Servicio técnico de mis equipos"); el técnico ve las órdenes por cliente en Mis Trabajos.

Commits: 57912f2c (rol Técnico), 927495c9 (backend), 2e4ee5f5 (frontend técnico), + CU27.

# Venta a crédito / Cartera (CU28 · CU29) ✅ COMPLETADO
Financiamiento **POR PRODUCTO** según su precio unitario. SQL `009_credito.sql`
(`plan_credito` + `cuota`). Modelos/endpoints en `orders`. El cálculo (recargo,
inicial, cuotas, mora) lo hace el **backend** (sin triggers).

**CU28 — Venta a crédito:** el vendedor, en la página **Créditos → Registrar**,
elige una venta y un producto elegible (precio unitario Bs 1–15.000). El sistema
calcula el plan y muestra la **simulación** (financiado, recargo, inicial, cuotas).
- Rangos: **1–5.000 → 6 cuotas (+20%)**, **5.001–10.000 → 9 (+25%)**, **10.001–15.000 → 12 (+30%)**.
- `precio_financiado = precio_base × (1 + recargo%)`; **inicial 20%** del financiado
  (pagada al inicio); `cuota = (financiado − inicial) / n` (la última absorbe el redondeo).
- Al crear el plan se genera el **calendario de cuotas** (1 por mes, la 1.ª vence en 1 mes).
- **Mora:** una cuota vencida sin pagar recibe **+10%** y el cliente queda **bloqueado**
  para nuevos créditos (se calcula perezosamente al leer: no hay cron). Un plan con
  cuota vencida pasa a `moroso`; pagadas todas → `pagado`.
- **Un plan por ítem de venta** (no se duplica). Todo en bitácora (módulo "Crédito").

**CU29 — Cartera / cobranza:** en la misma página, pestaña **Cartera** (admin/vendedor):
- Resumen: **total financiado, total cobrado, por cobrar, en mora**, conteo de planes
  vigentes/morosos/pagados y clientes bloqueados.
- **Proyección de cobros** por mes (cuotas pendientes agrupadas por vencimiento).
- Lista de planes con su calendario de cuotas y el botón **"Cobrar"** por cuota
  (marca pagada, baja el saldo, recalcula el estado del plan).

**Nota de diseño:** el plan es una **capa de financiamiento** que cuelga del
`detalleventa` (no altera stock/pagos de la venta original). Endpoints:
`GET/POST /planes-credito/`, `/simular/`, `/bloqueo/`, `PATCH /pagar-cuota/`, `/cartera/`.
Menú **Créditos** (admin + vendedor). Frontend: `Creditos.tsx` + `creditoAPI`.

---

## Actor × Caso de Uso

| | CU20 | CU21 | CU22 | CU23 | CU24 | CU25 | CU26 | CU27 | CU28 | CU29 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Cliente | ✅ | ✅ | ✅ | | | ✅ | ✅ | ✅ | ✅ | |
| Vendedor | | ✅ | | ✅ | | ✅ | ✅ | | ✅ | |
| Admin | | ✅ | | ✅ | ✅ | ✅ | ✅ | | ✅ | ✅ |
| Técnico | | ✅ | | | | ✅ | ✅ | ✅ | | |
