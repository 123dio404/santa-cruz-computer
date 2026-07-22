# Mapa de rutas — Mis tres casos de uso

> **Para qué sirve.** Ubicar, para cada uno de mis casos de uso, **dónde vive el código**: la
> pantalla del frontend, el método que llama a la API, la ruta HTTP, y la vista/lógica del backend.
> Así, en la defensa, puedo **señalar el archivo y la línea** de cada cosa sin buscar en vivo.
>
> **Todas las rutas fueron verificadas contra el código real** (líneas incluidas). La docente no pide
> explicar qué hace cada línea, pero dejé un comentario breve de la lógica en cada paso por si ayuda.
>
> **Mis tres casos de uso:**
> | Mi CU | Módulo | Ruta de la pantalla |
> |---|---|---|
> | **CU20** | Promociones programadas | `/promociones` |
> | **CU21** | Venta a crédito | `/creditos`, `/sales`, `/mis-creditos` |
> | **CU22** | Cartera de cobranza | `/creditos` (pestaña Cartera) |

---

## Cómo leer este mapa

El sistema tiene **4 capas**. Una acción del usuario recorre siempre el mismo camino:

```
[1] Pantalla (React)          Frontend/src/app/pages/*.tsx
        │  llama a
        ▼
[2] Cliente de API            Frontend/src/app/services/api.ts   ← el ÚNICO punto de salida
        │  HTTP (REST + JWT)
        ▼
[3] Ruta + Vista (Django)     Backend/apps/*/urls.py  →  views.py
        │  SQL
        ▼
[4] Tabla en PostgreSQL       (modelo en Backend/apps/*/models.py)
```

> **Dato para señalar:** todo el frontend habla con el backend **únicamente** por
> `Frontend/src/app/services/api.ts`. No hay ningún otro punto de contacto.

---

# ⭐ CU20 — Promociones programadas

**Idea:** el admin crea un descuento en % sobre un producto, con fecha de inicio y fin. Mientras está
vigente, la tienda **muestra y cobra** el precio rebajado, calculado al vuelo (no se guarda).

### Ruta pantalla → base de datos

| # | Capa | Archivo | Línea(s) | Qué hace |
|---|---|---|---|---|
| 1 | **Pantalla** | `Frontend/src/app/pages/Promociones.tsx` | 26, 66, 81, 91 | Vista del admin: lista, crea, elimina promos y envía ofertas por correo |
| 1b | **Ruta de la pantalla** | `Frontend/src/app/routes.tsx` | 216 | `path: '/promociones'` |
| 2 | **Cliente de API** | `Frontend/src/app/services/api.ts` | 951–972 | Objeto `promocionesAPI`: `getAll`, `create`, `remove`, `enviarOfertas` |
| 3 | **Ruta HTTP** | `Backend/apps/products/urls.py` | 25 | `router.register(r'promociones', PromocionViewSet)` |
| 3b | **Vista (backend)** | `Backend/apps/products/views.py` | 161–264 | `PromocionViewSet`: CRUD + `enviar_ofertas` (línea 205) |
| 4 | **Tabla** | `Backend/apps/products/models.py` | 152–175 | Modelo `Promocion` → tabla `promocion` |

### Dónde está la LÓGICA clave (lo que conviene poder señalar)

| Qué | Archivo | Línea(s) | Detalle |
|---|---|---|---|
| **El precio con descuento se CALCULA, no se guarda** | `Backend/apps/products/serializers.py` | 137–150 | En `ProductoSerializer`: busca la promo vigente hoy y devuelve `precio_actual × (1 − %/100)`; si no hay, `precio_promocional = None` |
| **Marca de vigencia** | `Backend/apps/products/serializers.py` | 24–47 | `PromocionSerializer`: campos calculados `precio_promocional` y `vigente` |
| **La tienda muestra el precio rebajado** | `Frontend/src/app/pages/Store.tsx` | 93, 242, 281, 377–386 | Usa `precio_promocional` para mostrar y para cobrar |

> **Para la defensa (CU20):** *"El precio promocional no está almacenado en ninguna columna: se
> calcula al leer el producto, en `serializers.py:137`. Por eso, cuando la promoción vence, el precio
> vuelve solo a su valor normal — no hace falta ninguna tarea programada."*

---

# ⭐ CU21 — Venta a crédito

**Idea:** una venta se financia en cuotas. El sistema calcula la cuota inicial y el cronograma según
el precio del producto. Hay **dos formas de originar un crédito**: presencial (walk-in) y desde el
punto de venta (método de pago "Al crédito").

### Ruta pantalla → base de datos

| # | Capa | Archivo | Línea(s) | Qué hace |
|---|---|---|---|---|
| 1a | **Pantalla — crédito presencial** | `Frontend/src/app/pages/Creditos.tsx` | (pestaña Registrar) | Wizard walk-in con checklist embebido |
| 1b | **Pantalla — desde venta** | `Frontend/src/app/pages/Sales.tsx` | 224, 244, 252, 282 | Método de pago "Al crédito": chequea bloqueo, simula el plan, lo crea |
| 1c | **Pantalla — vista del cliente** | `Frontend/src/app/pages/MisCreditos.tsx` | 58, 70, 91, 102 | El cliente ve sus créditos y paga cuotas en línea |
| 1d | **Rutas de las pantallas** | `Frontend/src/app/routes.tsx` | 226, 351 | `/creditos` y `/mis-creditos` |
| 2 | **Cliente de API** | `Frontend/src/app/services/api.ts` | 1094–1210 | Objeto `creditoAPI`: `simular`, `bloqueo`, `walkIn`, `crearDesdeVenta`, `misCreditos`, `pagarCuota`, `checkoutCuota`… |
| 3 | **Rutas HTTP** | `Backend/apps/orders/urls.py` | 33, 40–43 | `planes-credito` (router) + rutas Stripe de cuota |
| 3b | **Vista (backend)** | `Backend/apps/orders/views.py` | 1578+ | `PlanCreditoViewSet` (ver acciones abajo) |
| 3c | **Pago de cuota (Stripe)** | `Backend/apps/orders/stripe_views.py` | 381, 506, 527 | `CheckoutCuotaView`, `ConfirmarCuotaView`, `VerificarCuotaPendienteView` |
| 4 | **Tablas** | `Backend/apps/orders/models.py` | 408–515 | `PlanCredito`, `Cuota`, `ChecklistCredito` → tablas `plan_credito`, `cuota`, `checklist_credito` |

### Acciones del backend (`PlanCreditoViewSet`, todas en `orders/views.py`)

| Endpoint HTTP | Método Python | Línea | Qué hace |
|---|---|---|---|
| `GET  /planes-credito/simular/` | `simular` | 1619 | Devuelve el plan calculado (inicial, cuotas, recargo) sin guardar nada |
| `GET  /planes-credito/bloqueo/` | `bloqueo` | 1687 | ¿El cliente puede recibir crédito? (mora + límite de 3 activos) |
| `POST /planes-credito/walk-in/` | `walk_in` | 1865 | **Crédito presencial ATÓMICO**: venta + detalle + plan + cuotas + pago inicial en una transacción |
| `POST /planes-credito/desde-venta/` | `desde_venta` | 1885 | Crea el plan desde el método "Al crédito" de `/sales` |
| `GET  /planes-credito/mis-creditos/` | `mis_creditos` | 1631 | Los créditos del cliente logueado, con su cronograma |
| `PATCH /planes-credito/pagar-cuota/` | `pagar_cuota` | 1997 | Cobro de cuota en efectivo + comprobante |

### Dónde está la LÓGICA clave

| Qué | Archivo | Línea(s) | Detalle |
|---|---|---|---|
| **Tarifario del crédito** (rangos, inicial, mora) | `Backend/apps/orders/views.py` | 1400–1406 | `CREDITO_RANGOS` (6/9/12 cuotas), `CREDITO_INICIAL_PCT = 20`, `CREDITO_MORA_PCT = 10` |
| **Cálculo del plan** | `Backend/apps/orders/views.py` | 1424 | `calcular_credito()`: inicial, cuota, saldo; la última cuota absorbe el redondeo |
| **Mora** | `Backend/apps/orders/views.py` | 1549 | `_refrescar_moras()`: aplica el 10 % a la cuota vencida |

> **Para la defensa (CU21):** *"Toda la lógica del crédito vive en el backend, en Python
> (`views.py:1400` en adelante), no en la base de datos. El crédito presencial se crea de forma
> atómica en `walk_in` (`views.py:1865`): si algo falla, no queda ni la venta ni el plan a medias."*

---

# ⭐ CU22 — Cartera de cobranza

**Idea:** una vista consolidada de la deuda por cobrar — total otorgado, cobrado, saldo, clientes en
mora y proyección. **No tiene tabla propia:** se calcula sumando sobre `plan_credito` y `cuota`.

### Ruta pantalla → base de datos

| # | Capa | Archivo | Línea(s) | Qué hace |
|---|---|---|---|---|
| 1 | **Pantalla** | `Frontend/src/app/pages/Creditos.tsx` | 108, 119, 143–144 | Pestaña **Cartera**: carga el resumen y lo muestra |
| 1b | **Ruta de la pantalla** | `Frontend/src/app/routes.tsx` | 226 | `/creditos` (misma página, pestaña Cartera) |
| 2 | **Cliente de API** | `Frontend/src/app/services/api.ts` | 1198–1201 | `creditoAPI.cartera()` → `GET /planes-credito/cartera/` |
| 3 | **Ruta HTTP** | `Backend/apps/orders/urls.py` | 33 | Cubierta por el router de `planes-credito` |
| 3b | **Vista (backend)** | `Backend/apps/orders/views.py` | 2051–2057 | Acción `cartera`: agrega en memoria y refresca moras |
| 4 | **Tablas (origen del dato)** | `Backend/apps/orders/models.py` | 408–478 | Lee `plan_credito` y `cuota` — **no crea ninguna tabla** |

### Lo importante de este CU

| Qué | Archivo | Línea(s) | Detalle |
|---|---|---|---|
| **La cartera NO persiste nada** | `Backend/apps/orders/views.py` | 2052 | La acción `cartera` recorre los planes, les refresca la mora (`_refrescar_moras`) y **suma en memoria**; devuelve el total sin guardarlo |

> **Para la defensa (CU22):** *"La cartera no tiene tabla porque el saldo pendiente es un dato
> DERIVADO: se obtiene sumando las cuotas impagas. Guardarlo sería duplicar información que ya existe,
> con el riesgo de que los dos valores se desincronicen. Por eso se calcula al consultarla, en
> `views.py:2052`."*

---

## Resumen — un solo cuadro para tener a mano

| Caso de uso | Pantalla (frontend) | Cliente API | Ruta HTTP | Vista (backend) | Tabla(s) |
|---|---|---|---|---|---|
| **CU20 Promociones** | `Promociones.tsx` (+ `Store.tsx`) | `promocionesAPI` `api.ts:951` | `products/promociones/` | `PromocionViewSet` `views.py:161` · lógica `serializers.py:137` | `promocion` |
| **CU21 Venta a crédito** | `Creditos.tsx`, `Sales.tsx`, `MisCreditos.tsx` | `creditoAPI` `api.ts:1094` | `orders/planes-credito/…` | `PlanCreditoViewSet` `views.py:1578` · cálculo `views.py:1424` | `plan_credito`, `cuota`, `checklist_credito` |
| **CU22 Cartera** | `Creditos.tsx` (pestaña Cartera) | `creditoAPI.cartera` `api.ts:1199` | `orders/planes-credito/cartera/` | acción `cartera` `views.py:2052` | *(ninguna — agrega sobre `plan_credito` y `cuota`)* |

> **Regla de oro para la defensa:** el camino es siempre **pantalla → `api.ts` → `urls.py` →
> `views.py` → tabla**. Si te preguntan "¿dónde está X?", ubicá primero en qué capa cae y seguí la
> fila de la tabla de ese caso de uso.
