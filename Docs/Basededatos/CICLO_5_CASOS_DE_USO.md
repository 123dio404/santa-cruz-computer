# Ciclo 5 — Casos de Uso (CU20 a CU29)

> Documento **vivo**: se actualiza cada vez que se avanza un caso de uso.
> Explica qué hace cada CU, su flujo y su estado de implementación.

## Resumen y estado

| ID | Caso de Uso | Actores | Estado |
|----|-------------|---------|--------|
| CU20 | Chatbot de atención (IA) | Cliente | ⬜ Pendiente (va al final) |
| CU21 | Notificaciones (sistema + correo) | Todos | ✅ Completado |
| CU22 | Recibo de pago + Factura por correo | Cliente | ✅ Completado |
| CU23 | Devoluciones (RMA) | Vendedor/Admin | ⬜ Pendiente |
| CU24 | Promociones programadas | Admin | ⬜ Pendiente |
| CU25 | Servicio preventivo | Cliente/Vendedor/Admin/Técnico | ⬜ Pendiente |
| CU26 | Servicio correctivo | Cliente/Vendedor/Admin/Técnico | ⬜ Pendiente |
| CU27 | Ficha/historial de mantenimiento | Técnico/Cliente | ⬜ Pendiente |
| CU28 | Venta a crédito | Cliente/Vendedor/Admin | ⬜ Pendiente |
| CU29 | Cartera de créditos / cobranza | Admin | ⬜ Pendiente |

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

# CU23 — Devoluciones (RMA) ⬜ PENDIENTE
El vendedor/admin registra una devolución en el mostrador (nace `aprobada` o `rechazada`). Parámetros: ≤7 días, venta existe, no devuelto antes, inspección física OK. Trigger `AFTER INSERT` reingresa stock solo si `aprobada`. Nunca toca `detalleventa`. Dashboard: ventas netas = brutas − devoluciones. Reporte de ventas marca la línea como "Devuelta".

# CU24 — Promociones programadas ⬜ PENDIENTE
Admin define descuento % por producto/categoría con `fecha_inicio`/`fecha_fin`. La tienda muestra el precio rebajado mientras esté vigente. Tabla `promocion`.

# CU25 — Servicio preventivo ⬜ PENDIENTE
Mantenimiento todo-en-uno (hardware + software). GRATIS para laptops de la tienda con garantía vigente (2 usos, 6 meses de separación); externos/agotados pagan 200 Bs. Ejecuta el Técnico; asigna Vendedor/Admin.

# CU26 — Servicio correctivo ⬜ PENDIENTE
Catálogo de servicios de software con precio fijo: virus 100, formateo 150 (+instalación de programas con licencia), recuperación de datos 300/450/1000 según capacidad. Se pueden pedir varios; se suman.

# CU27 — Ficha/historial de mantenimiento ⬜ PENDIENTE
Consulta del historial de servicios (preventivos + correctivos) por equipo. Refuerza CU25/CU26.

# CU28 — Venta a crédito ⬜ PENDIENTE
Crédito POR PRODUCTO según el precio unitario: 1–5.000→6 cuotas (+20%), 5.001–10.000→9 (+25%), 10.001–15.000→12 (+30%). Inicial 20% del precio financiado, sin interés mensual, entrega al inicio. Mora: recargo 10% + bloqueo. Tablas `plan_credito` + `cuota`.

# CU29 — Cartera de créditos / cobranza ⬜ PENDIENTE
Panel del admin con todos los créditos: por cobrar, vencidos, morosos, proyección. Consulta sobre `plan_credito` + `cuota`.

---

## Actor × Caso de Uso

| | CU20 | CU21 | CU22 | CU23 | CU24 | CU25 | CU26 | CU27 | CU28 | CU29 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Cliente | ✅ | ✅ | ✅ | | | ✅ | ✅ | ✅ | ✅ | |
| Vendedor | | ✅ | | ✅ | | ✅ | ✅ | | ✅ | |
| Admin | | ✅ | | ✅ | ✅ | ✅ | ✅ | | ✅ | ✅ |
| Técnico | | ✅ | | | | ✅ | ✅ | ✅ | | |
