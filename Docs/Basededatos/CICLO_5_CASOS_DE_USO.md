# Ciclo 5 — Casos de Uso (CU20 a CU29)

> Documento **vivo**: se actualiza cada vez que se avanza un caso de uso.
> Explica qué hace cada CU, su flujo y su estado de implementación.

## Resumen y estado

| ID | Caso de Uso | Actores | Estado |
|----|-------------|---------|--------|
| CU20 | Chatbot de atención (IA) | Cliente | ⬜ Pendiente (va al final) |
| CU21 | Notificaciones (sistema + correo) | Todos | ✅ Completado |
| CU22 | Recibo de pago + Factura por correo | Cliente | ✅ Completado |
| CU23 | Devoluciones (RMA) | Vendedor/Admin/Cliente | ✅ Completado |
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
- **Trigger `AFTER INSERT`** reingresa stock SOLO si `aprobada` (una vez). NUNCA toca `detalleventa`/`factura`/`pagoventa`.
- **Reporte de ventas** (Excel/PDF): las líneas devueltas salen como **"Devuelta"** + resumen bruto − devoluciones = **ventas netas**.
- **Dashboard:** tarjeta **"Ingresos Netos"** = ingresos − devoluciones aprobadas.
- **Reporte de devoluciones** propio (Excel/PDF, color ámbar) con total reembolsado.
- Tabla `devolucion` (SQL 005). Modelo/endpoints en `orders`.

## Mejoras del ciclo 5 (2026-07-08)

**1. Bloqueo de doble devolución** (frontend + backend):
- El botón "Registrar devolución" se **deshabilita** si todos los ítems de la venta ya fueron procesados (aprobados o rechazados), con tooltip explicativo.
- El dropdown del modal filtra los ítems ya procesados. Los parciales se etiquetan "X de Y disponibles".
- Backend valida `estado__in=['aprobada','rechazada']`: una rechazada cierra la decisión sobre esas unidades (no se puede reintentar), no solo las aprobadas.

**2. Inspección física granular** (checklist de 4 puntos):
- Se dividió "Sin daño ni manipulación" en 2 puntos independientes: **Sin daño** y **Sin manipulación**.
- Ahora son 4: Sin daño / Sin manipulación / Es el mismo producto vendido / Completo (accesorios/empaque).
- El resultado se guarda en `devolucion.insp_sin_dano`, `insp_sin_manipulacion`, `insp_mismo_producto`, `insp_completo` (SQL 011).

**3. Anulación de garantía coherente con la inspección:**
- **Aprobada** → anula la garantía + guarda resolución *"por devolución aprobada (RMA-YYYY-000042)"*.
- **Rechazada por daño** (no marcado "Sin daño") → anula la garantía + guarda resolución *"por daño detectado en la inspección física"*.
- **Rechazada por manipulación** (no marcado "Sin manipulación") → anula la garantía + guarda resolución *"por manipulación detectada"*.
- **Rechazada por otros motivos** (no es el mismo producto, incompleto, fuera de plazo, etc.) → garantía SIGUE VIGENTE.
- Aviso visual en el modal para el vendedor: *"⚠️ Si rechazas con daño o manipulación sin marcar, la garantía se anulará automáticamente"*.

**4. Notificación al cliente + comprobante RMA:**
- Al aprobar o rechazar se envía **correo Brevo** + **campana en la app** con el resultado.
- Número de **comprobante correlativo** `RMA-YYYY-000042` derivado del `id` de la devolución + año actual.
- Correo aprobada (verde): comprobante, cantidad, monto de reembolso, método (efectivo en tienda), instrucciones para retirar.
- Correo rechazada (rojo): comprobante, motivo del rechazo escrito por el vendedor, invitación a acercarse a la tienda si hay dudas.
- Reutiliza el patrón de CU21: `_email_html` + `crear_notificacion(canal='ambos')`.
- Si el cliente no tiene correo cargado, la devolución se registra igual (bloque `try/except` silencioso).
- Diseño preparado para agregar `cliente.cuenta_bancaria` a futuro (transferencia bancaria) sin rediseñar el correo.

**5. Vista del cliente en "Mis Pedidos"** (`Orders.tsx`):
- **Card principal:** pill de resumen *"🔄 1 devolución aprobada · 1 rechazada"* al pie de la card cuando el pedido tiene devoluciones.
- **Modal "Ver Detalles":** por producto, bloque verde (aprobada + comprobante + monto + instrucciones) o rojo (rechazada + comprobante + motivo).
- Badge `🚫 Garantía anulada` con leyenda explicativa cuando corresponde (por devolución aprobada / por daño detectado / por manipulación detectada).
- El botón **"Reclamar garantía" queda oculto** si la garantía está anulada.
- **Defensa en 2 capas** contra reclamos de garantía sobre productos ya devueltos:
  - Frontend: `g.vigente = false` cuando `estado='anulada'` → botón no aparece.
  - Backend: endpoint `PATCH /garantias/{id}/reclamar/` rebota 400 si `estado != 'activa'`.
- Endpoint nuevo: `GET /devoluciones/?cliente=<id>` para que el cliente cargue solo las suyas.

## Actores CU23 (actualizado)
- **Vendedor/Admin:** registra la devolución, aplica la inspección física de 4 puntos, aprueba o rechaza.
- **Cliente:** ve el resultado en su bandeja de notificaciones (campana + correo con comprobante RMA), consulta el estado y motivo en "Mis Pedidos".

Commits: 2bc875b1 (backend base), d0fb2735 (UI), 79212ba8 (reportes/dashboard), 20f4096e (bloqueo doble devolución), aad2c757 (notificación cliente + comprobante RMA), 6a5c29f9 (inspección granular 4 puntos + anulación de garantía + vista del cliente en Mis Pedidos).

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

**Órdenes:** estados agendado→en_proceso→finalizado→entregado (o cancelado en cualquier momento). El estado `solicitado` sigue existiendo por backward-compat con órdenes viejas pero ninguna orden nueva pasa por ahí — la fecha de retiro se pide al momento de registrar. Página **Mis Trabajos** del técnico: registrar + lista + detalle + checklist. Todo en bitácora (módulo "Servicio Técnico").

**CU27 — Ficha/historial:** el cliente ve su historial de servicios en **Mis Pedidos** (sección "Servicio técnico de mis equipos"); el técnico ve las órdenes por cliente en Mis Trabajos.

## Mejoras del ciclo 5 (2026-07-09)

Se rediseñó el flujo para que el cliente supiera cuándo puede venir a retirar su equipo. Los cambios NO afectan diagramas del CU25/CU26 más allá de agregar el estado **entregado** al diagrama de estados.

**1. Fechas de retiro y estado "entregado"** (SQL `012_orden_fechas_entrega.sql`):
- Nuevas columnas en `orden_servicio`:
  - `fecha_entrega_prevista` (DATE): día acordado con el cliente para el retiro.
  - `fecha_entrega_real` (TIMESTAMP): momento exacto en que el cliente vino a retirar.
- Nuevo estado `entregado` (valor del enum `estado`, VARCHAR libre — no requiere ALTER de esquema).
- Flujo final: **solicitado → agendado (con fecha) → en_proceso → finalizado → entregado**.

**2. Modal "Agendar" con date picker** (`MisTrabajos.tsx`):
- El técnico ya no toca "Agendar" y salta directo al siguiente estado — ahora se abre un modal donde elige la fecha de retiro.
- Botón **"Reagendar"** aparece si ya estaba agendada (precarga la fecha actual).
- Endpoint `PATCH /ordenes-servicio/{id}/agendar/` que valida fecha ≥ hoy y no permite agendar órdenes finalizadas/entregadas/canceladas.
- Correo al cliente con la fecha destacada en caja azul + ubicación + costo. En caso de reagenda el correo dice "Actualizamos la fecha...".

**3. Botón "Marcar entregado"** (`MisTrabajos.tsx`):
- Aparece solo en órdenes finalizadas. Pide confirmación.
- Endpoint `PATCH /ordenes-servicio/{id}/entregar/` graba `fecha_entrega_real=now`. **NO envía correo** (el cliente está en tienda al retirar).

**4. Correo al finalizar con texto ADAPTATIVO** (3 escenarios):
- **Adelantado** (finalización < prevista): *"¡Buenas noticias! Tu equipo está listo antes de lo previsto"* — caja verde con "podés retirarlo desde HOY".
- **En fecha** (finalización = prevista): *"Como te habíamos dicho, tu equipo está listo HOY"* — caja azul confirmando la fecha original.
- **Retrasado** (finalización > prevista): *"Tu equipo ya está listo. Disculpá el retraso"* — caja roja con la fecha original + "podés retirarlo desde HOY".
- Los tres incluyen los **trabajos realizados** (checklist marcado + servicios cotizados) y notas del técnico.

**5. Vista `/agenda` real** (nueva página `Agenda.tsx`, reemplaza el Placeholder):
- Órdenes **agendadas** y **en proceso** agrupadas por día (fecha_entrega_prevista), ordenadas cronológicamente.
- El día de hoy queda destacado con "📌 HOY".
- Botones inline "Iniciar" (agendado → en proceso) y "Finalizar" (en proceso → finalizado) sin necesidad de abrir el detalle.
- Feedback con toast al éxito.

**6. Vista del cliente en "Mis Pedidos" reagrupada** (`Orders.tsx`):
- La sección "Servicio técnico de mis equipos" pasa a mostrar **3 subsecciones** en vez de una sola lista mezclada:
  1. **✅ Listo para retirar** (verde destacado): órdenes finalizadas. Muestra "✨ Adelantado — podés retirarlo desde HOY" si aplica. Card expandible con detalle de trabajos realizados.
  2. **⚙️ En proceso** (blanco): solicitado/agendado/en_proceso. Muestra la fecha de retiro prevista cuando aplica.
  3. **📚 Historial** (colapsado por default con "Ver historial completo"): entregado/cancelado.
- Estado `entregado` agregado al mapa de badges (color esmeralda).
- Contadores en cada título de sección (ej. "En proceso (3)").
- Secciones sin ítems no se muestran (no ocupa espacio vacío).

**7. Feedback UX en las acciones del técnico:**
- Todas las acciones (agendar, iniciar, finalizar, entregar, cancelar) ahora **cierran el modal detalle** y muestran un **toast** de confirmación (verde) o error (rojo).
- Antes el modal quedaba abierto y no daba feedback claro, era confuso.

## Refinamiento del flujo (2026-07-09, mismo día por la tarde)

Tras probar la vista del técnico se detectó que el paso "Registrar → Agendar" era engorroso (2 modales, 2 clicks para llegar al mismo resultado) y que la página `/agenda` duplicaba lo que ya mostraba MisTrabajos. Se simplifica.

**1. Fecha obligatoria al registrar** (`views.py::create`, `MisTrabajos.tsx`):
- El modal "Registrar servicio" ahora exige `fecha_entrega_prevista` desde el primer paso (input date, default hoy+3 días, `min=hoy`).
- La orden **nace directamente en estado `agendado`** (no pasa por `solicitado`).
- El backend valida fecha ≥ hoy y dispara `_notificar_agendada` al cliente (correo + campana) al momento del create, no en un paso posterior.
- El botón "Agendar" del modal detalle desaparece; sólo queda **"Reagendar"** para cambiar la fecha de una orden ya agendada.
- Flujo real ahora: **agendado (con fecha desde el inicio) → en_proceso → finalizado → entregado**.

**2. Filtros con contador** (`MisTrabajos.tsx`):
- Reemplazo de los filtros planos (`Todas`, `Agendado`, etc.) por **tabs con badge de contador** al estilo de la página Users.
- Cada tab muestra la cantidad: `Todas 12`, `Agendado 3`, `En proceso 2`, `Finalizado 5`, `Entregado 2`.
- Tab default: **Agendado** (lo más útil para el técnico al abrir la vista).
- Se quita el filtro `Solicitado` de los tabs (las viejas siguen apareciendo bajo "Todas").

**3. Cards agrupadas por urgencia** (`MisTrabajos.tsx`):
- Cuando el filtro es **Agendado** o **En proceso**, las cards se ordenan por `fecha_entrega_prevista` ascendente y se agrupan en secciones visuales:
  - **⚠️ Atrasadas** (rojo): fecha < hoy
  - **📌 HOY** (azul destacado): fecha = hoy
  - **Mañana** (amarillo): fecha = mañana
  - **Esta semana** (gris): dentro de los próximos 7 días
  - **Más adelante** (gris claro): fuera del rango semanal
  - **Sin fecha** (gris claro): sólo para órdenes viejas sin fecha
- Los demás filtros (Finalizado, Entregado, Todas) siguen mostrando una lista plana sin agrupación.

**4. Botones inline en las cards** (`MisTrabajos.tsx`):
- Cada card muestra el botón de la próxima acción (Iniciar / Finalizar / Marcar entregado) directamente, sin abrir el modal detalle.
- **Excepción:** en órdenes **agendadas**, el botón "Iniciar" **abre el modal detalle** para que el técnico pueda revisar y tickear el checklist (tareas del preventivo) antes de arrancar el trabajo, no arranca directamente.
- Feedback siempre por toast (verde/rojo).

**5. Eliminación de la página `/agenda`**:
- La nueva vista de MisTrabajos (tabs con contador + agrupación por urgencia) cubre exactamente lo que hacía `/agenda`.
- Se borra `Frontend/src/app/pages/Agenda.tsx`, se quita la ruta `/agenda` de `routes.tsx` y el ítem "Agenda" del menú del técnico en `Layout.tsx`.
- Ahora el técnico tiene **un solo lugar** (Mis Trabajos) para ver, filtrar y accionar sus órdenes.

Commits: 57912f2c (rol Técnico), 927495c9 (backend), 2e4ee5f5 (frontend técnico), c3f67ab1 (CU27 vista cliente base), b42b7659 (fechas de retiro + estado entregado + agenda real + vista cliente reagrupada + correo adaptativo), e5c62b16 (refinamiento: fecha obligatoria al registrar + tabs con contador + agrupación por urgencia + eliminación de /agenda), 383ff4e7 (Iniciar desde card agendada abre el detalle para revisar checklist).

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

## Refactor CU28/CU29 (2026-07-09)

El flujo original tenía un problema: la venta se cobraba al contado en `/sales`
y después había que ir a `/creditos` a "crear un plan" sobre esa venta ya
cobrada. Al hacer QA se detectó incoherencia. El refactor **elimina el paso
intermedio**: la venta nace al crédito, atómicamente, con checklist embebido
y factura HTML por correo.

**1. SQL nuevo `010_checklist_credito.sql`:**
- Tabla nueva `checklist_credito` (1:1 con `plan_credito`, `ON DELETE CASCADE`).
  Guarda `tipo_empleo` (dependiente/independiente), `antiguedad_meses`, 3 booleans
  comunes (`ci_solicitante`, `ci_conyuge`, `factura_servicios`), 2 booleans del
  dependiente (`boletas_pago`, `extracto_gestora`) y 6 del independiente
  (`facturas_ultimo_ano`, `estados_financieros`, `nit`, `croquis_domicilio`,
  `croquis_negocio`, `respaldos_patrimoniales`), `observaciones` y `fecha_verificacion`.
- ALTER `plan_credito`: `origen VARCHAR(20)` (walk_in | al_credito_sales) y
  `numero_factura VARCHAR(20)`.
- ALTER `cuota`: `stripe_payment_intent_id`, `stripe_session_pending`,
  `metodo_pago` (efectivo | stripe), `numero_factura`.
- SEQUENCE `factura_credito_seq` — correlativo único global para las facturas
  del módulo, formateadas como `FCR-2026-000042`.
- Todo idempotente con `IF NOT EXISTS`.

**2. Endpoints nuevos (backend):**
- `POST /planes-credito/walk-in/` — flujo presencial en `/creditos`. Crea de
  forma atómica: venta + detalle + PagoVenta con la inicial en efectivo + plan
  con `origen='walk_in'` + checklist + N cuotas + `numero_factura`. Fuerza la
  venta a `completed`/`entregado` porque el producto sale al firmar el crédito.
- `POST /planes-credito/desde-venta/` — flujo desde `/sales` cuando el vendedor
  elige el método de pago "Al crédito". Idéntico al walk-in salvo por `origen='al_credito_sales'`.
- `GET  /planes-credito/mis-creditos/` — vista del CLIENTE logueado (filtra por
  el `user_id` del JWT). Devuelve todos sus créditos + resumen (activos, saldo,
  próxima cuota, cuotas vencidas). 401 si no hay token, 403 si el rol no es cliente.
- `POST /stripe/checkout-cuota/` — el cliente inicia el pago online de una
  cuota. Crea Checkout Session por `monto + mora` y guarda `session.id` en
  `cuota.stripe_session_pending` para el fallback.
- `POST /stripe/confirmar-cuota/` — return-URL tras pagar. Verifica en Stripe,
  cierra la cuota (idempotente), emite `numero_factura`, envía factura al cliente.
- `POST /stripe/verificar-cuota-pendiente/` — botón "¿Ya pagaste?" para
  recuperar sesiones cuando el cliente cerró la pestaña. Reusa el mismo helper.

**3. Refactor de `PATCH /planes-credito/pagar-cuota/`** (cobro presencial):
- Guarda `metodo_pago='efectivo'` y emite `numero_factura` desde la SEQUENCE.
- Delega el envío de correo/campana al helper compartido con el pago Stripe.

**4. Templates HTML de factura** (`Backend/templates/facturas/`):
- `factura_inicial.html`: banda azul, logo, datos empresa (NIT), datos cliente,
  tabla precio base + recargo + financiado, caja verde con la inicial cobrada,
  cronograma completo de las N cuotas con fechas.
- `factura_cuota.html`: banda verde, monto pagado destacado, mora si aplica,
  método (Efectivo/Stripe con link al recibo si hay), progreso visual (✓/!/·),
  saldo restante del crédito.
- Ambos renderizados con `Backend/apps/orders/views.py::_render_factura_credito`
  (helper que inyecta logo_url, frontend_url, empresa por default).

**5. Frontend — 4to método de pago "Al crédito" en `Sales.tsx`:**
- Ícono `Wallet`, color morado.
- Restricciones visibles: 1 solo producto por venta, cliente registrado
  obligatorio, precio unitario Bs 1–15.000.
- Al elegir cliente + método crédito → chequeo automático de bloqueo
  (mora → rojo, tope de 3 activos → rojo, 2 activos → advertencia naranja).
- Simulación en vivo del plan (precio base, recargo, financiado, inicial, cuotas).
- Botón "Aprobar crédito" reemplaza "Ver Factura" cuando el método es crédito.
- Modal de checklist embebido con tipo empleo + docs correspondientes + obs.
- Al éxito muestra el `numero_factura` FCR y limpia el carrito.

**6. Frontend — pestaña "+ Nuevo crédito presencial" en `Creditos.tsx`:**
- Reemplaza a la vieja "Registrar" (que dependía de una venta al contado previa).
- Búsqueda de cliente por nombre/CI/correo con vista previa del bloqueo.
- Búsqueda de producto auto-filtrada por rango Bs 1–15.000 y stock disponible.
- Simulación en vivo + modal de checklist embebido idéntico al de `/sales`.
- **Pestaña Cartera** mejorada: el `confirm()` nativo del cobro se reemplaza
  por un modal con desglose (monto + mora + total) y aviso de que se enviará
  factura. Toast al cobrar con el `numero_factura` FCR.

**7. Frontend — nueva página `/mis-creditos` (rol cliente):**
- Header con 4 cards (planes activos, saldo pendiente, cuotas pendientes/vencidas).
- Banner destacado con la próxima cuota (rojo si vencida).
- Lista de créditos colapsables con cronograma completo de cuotas.
- Botón "Pagar" en cuotas pendientes/vencidas → Stripe Checkout hospedado.
- Botón "¿Ya pagaste?" cuando la cuota tiene `stripe_session_pending`.
- Al volver del return-URL de Stripe (`?cuota_confirm=cs_xxx`) se llama automático
  a `confirmar-cuota`, se muestra toast del resultado y se limpia el query param
  con `setParams(replace)` para que un F5 no reintente.
- Modales de comprobante imprimible para la inicial y para cada cuota pagada.
- Aviso rojo en créditos morosos recordando que no puede tomar nuevos créditos.
- Ruta protegida con `allowedRoles=['client']`, ítem "Mis Créditos" en el menú
  del cliente.

**8. QA — casos borde verificados:**
- **Mora**: `_crear_credito_atomico` bloquea si `venc > 0`; frontend muestra
  banner rojo en `/sales`, `/creditos` walk-in y `/mis-creditos`.
- **Tope de 3 activos**: bloqueo al 3ro futuro; advertencia naranja al llegar
  a 2 (`bloqueo.motivo` retorna `mora` | `limite` | `advertencia` | null).
- **Cliente sin cuenta**: deshabilita el CTA en `/sales` y en `/creditos` walk-in.
- **Precio fuera de rango**: `calcular_credito` retorna None → 400 en backend
  y motivo visible en frontend.
- **Stripe cerrar pestaña**: `cuota.stripe_session_pending` persiste la sesión;
  el botón "¿Ya pagaste?" la recupera vía `/stripe/verificar-cuota-pendiente/`.
- **Reload de la página de confirmación**: `setParams(next, {replace:true})`
  limpia el `?cuota_confirm=` y el backend responde `estado_pago='ya_pagada'`
  sin reprocesar.

**9. Fix de UX en `Orders.tsx`** (Mis Pedidos del cliente):
- `VentaSerializer` expone `es_credito` y `credito_plan_id` (con prefetch para
  evitar N+1). El frontend muestra un badge indigo **"💳 Al crédito · Ver en
  Mis Créditos"** con link cuando la venta tiene un plan asociado, para que el
  cliente no confunda el total base con el total pagado hoy.

**Flujo final del cliente:**
1. Vendedor arma el crédito desde `/sales` (metodo "Al crédito") o desde
   `/creditos` (walk-in), cobra la inicial en efectivo y firma el checklist.
2. Sistema crea todo atómico + emite `FCR-2026-000042` + envía factura HTML
   con el cronograma completo al correo del cliente + notificación campana.
3. Cliente entra a `/mis-creditos`, ve sus créditos con la próxima cuota
   destacada.
4. Cliente paga cuotas online con tarjeta (Stripe Checkout) o presencialmente
   en efectivo con el vendedor.
5. Cada cobro emite otra factura FCR-… y le llega por correo con el progreso
   visual y saldo restante.

**Estado:** 12 pasos completos, ~15 commits (`97389591` → `aca20537`) en la
rama `rama_de_jose_carlos`. Todo pusheado a `equipo/rama_de_jose_carlos`.

Commits: 97389591 (SQL 010 + modelo checklist + walk-in), 6d97c577 (templates
factura HTML), ef4bfc8b (desde-venta), a84d5959 (mis-creditos), d6f195f4
(Stripe 3 endpoints), 94a1f879 (Sales.tsx método Al crédito), a38370b9 (cobro
efectivo helper compartido), 1bd4bfef (Creditos.tsx walk-in + toast), 31f4797d
(MisCreditos.tsx + rutas + menú), aca20537 (QA + es_credito en Mis Pedidos).

---

## Actor × Caso de Uso

| | CU20 | CU21 | CU22 | CU23 | CU24 | CU25 | CU26 | CU27 | CU28 | CU29 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Cliente | ✅ | ✅ | ✅ | ✅ | | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vendedor | | ✅ | | ✅ | | ✅ | ✅ | | ✅ | ✅ |
| Admin | | ✅ | | ✅ | ✅ | ✅ | ✅ | | ✅ | ✅ |
| Técnico | | ✅ | | | | ✅ | ✅ | ✅ | | |
