# Presentación Mesa 2026 — Análisis del Capítulo 1 (Perfil)

> **Qué es este archivo.** Es el análisis del **capítulo 1 (Perfil)** contrastado contra el sistema
> realmente construido, **enfocado en lo que TENGO QUE PRESENTAR YO**.
>
> **El encuadre correcto (importante):**
>
> - **CU1 – CU19 = base compartida.** Es el sistema que los tres integrantes presentamos por igual:
>   usuarios y roles, inventario, compras, ventas, carrito, pagos, facturación, bitácora, garantías
>   y reseñas. **También es mío.** No lo saco de mi documento.
> - **Ciclo 5 = repartido.** Acá es donde cada integrante suma lo suyo. **Yo sumo únicamente tres:**
>
>   | Mi CU | CU del grupo | Módulo |
>   |---|---|---|
>   | **CU20** ⭐ | CU24 | **Promociones programadas** |
>   | **CU21** ⭐ | CU28 | **Venta a crédito** |
>   | **CU22** ⭐ | CU29 | **Cartera de créditos / cobranza** |
>
> - **Lo que NO va en mi documento** (es de mis compañeros, Ciclo 5): chatbot de IA, notificaciones,
>   recibo/factura por correo, devoluciones (RMA) y servicio técnico preventivo/correctivo.
>
> **Cómo usarlo.** Cada sección tiene: 🔍 **qué dice hoy** · ⚠️ **el problema** · ✍️ **texto propuesto
> listo para pegar en tu Word**. Lo marcado con ⭐ es lo que tenés que defender vos.

---

## Resumen ejecutivo

| # | Hallazgo | Gravedad | Dónde |
|---|---|---|---|
| 1 | **Un bloque de ~11 párrafos está duplicado literalmente** (copiado dos veces) | 🔴 Crítico | Descripción del problema |
| 2 | El documento promete un **módulo de Reservas que no existe** | 🔴 Crítico | Proyecto |
| 3 | El documento promete **números de serie** y un **Kardex** que no existen en la BD | 🔴 Crítico | Alcance |
| 4 | ⭐ **Mis 3 casos de uso no están justificados en ninguna parte del capítulo 1** | 🔴 Crítico | Problema / Justificación / Objetivos |
| 5 | El **Alcance no menciona módulos de la base compartida** que sí existen (tienda, pagos, garantías, reseñas, bitácora) | 🟠 Alto | Alcance |
| 6 | La **Formulación del problema no formula nada** — es un resumen, no preguntas | 🟠 Alto | Formulación |
| 7 | El **Objetivo General se quedó en "inventario, compra y venta"** — no cubre créditos | 🟠 Alto ⭐ | Objetivos |

**En una frase:** el perfil describe el sistema tal como se imaginó al inicio (inventario + ventas),
y **nunca se actualizó**. Para vos el problema es concreto: **tus tres módulos no aparecen en el
capítulo 1**, y si la mesa lee ese capítulo y después ve tus casos de uso, la pregunta obvia es
*"¿y esto de dónde salió?"*.

---

# 1. Introducción

### 🔍 Qué dice hoy

> "Esta empresa trata de ventas de computadoras, laptops, componentes y accesorios."

Dos líneas, y solo habla de **venta al contado**.

### ⚠️ Problema

Nada en la introducción anticipa que la empresa **vende a crédito**. Tu documento entero gira en
torno a eso y el lector llega sin ninguna preparación.

### ✍️ Texto propuesto

> **Santa Cruz-Computer** es una empresa dedicada a la **comercialización de equipos y componentes
> de computación**: laptops, computadoras de escritorio, componentes internos (memorias RAM, discos,
> procesadores, tarjetas madre) y periféricos (monitores, teclados, mouse, accesorios).
>
> Su operación comercial no se limita a la venta al contado. Como es habitual en el rubro, la
> empresa **otorga facilidades de pago a clientes de confianza** y **aplica descuentos y promociones**
> para dinamizar la salida de determinados productos. Ambas prácticas, sin embargo, se administran
> hoy de manera informal.
>
> El presente proyecto desarrolla un sistema de información que sistematiza la gestión comercial de
> la empresa y, en particular, formaliza dos procesos hasta ahora sin control: **la venta a crédito
> con su respectiva cartera de cobranza** y **la administración de promociones con vigencia definida**.

> 💡 Con este último párrafo, **tus tres CU quedan anunciados desde la primera página**. ⭐

---

# 2. Rubro

### 🔍 Qué dice hoy

Bien redactado: describe el sector, la estructura mínima (propietario + 1-2 técnicos), la ausencia
de organigrama y los métodos manuales.

### ⚠️ Problema

Habla del **sector en general**, casi nunca de **Santa Cruz-Computer en particular**. La mesa
pregunta: *"¿y su empresa concretamente cómo está conformada?"*. Y la misión/visión están
enunciadas "en términos generales", como si no supieran cuál es la de su propia empresa.

### ✍️ Texto propuesto (agregar al final del Rubro)

> **Estructura de Santa Cruz-Computer.** La empresa está conformada por un **administrador/propietario**,
> un **vendedor** y un **técnico**. No cuenta con organigrama formal, por lo que las funciones se
> superponen: el propietario vende, cobra, decide las compras **y también decide a qué cliente se le
> otorga crédito**, sin ningún criterio formalizado.
>
> Esta estructura es determinante para el diseño del sistema: se implementan **tres roles operativos
> —administrador, vendedor y técnico—** más el rol **cliente**, que accede desde afuera a la tienda
> en línea y a la consulta de sus compras y **sus créditos**.
>
> **Misión.** Brindar soluciones tecnológicas confiables mediante la venta de equipos y componentes
> de computación, con precios accesibles, facilidades de pago y atención cercana.
>
> **Visión.** Consolidarse como referente del rubro tecnológico en Santa Cruz, con procesos
> trazables, canales de venta presenciales y en línea, y una gestión financiera ordenada.

> 💡 Fijate que metí "el propietario decide a quién dar crédito **sin criterio formalizado**". Esa
> frase es la semilla de tu CU21. Cuando en la defensa expliques el checklist de aprobación, va a
> quedar claro de dónde salió. ⭐

---

# 3. Proyecto

### 🔍 Qué dice hoy

Plantea el sistema en **dos fases**: (1) inventario, (2) ventas. Y agrega un **módulo de reservas**
para que los clientes soliciten productos por anticipado.

### ⚠️ Problema — 🔴 **EL MÓDULO DE RESERVAS NO EXISTE**

Lo verifiqué: en las **34 tablas** de la base de datos **no hay ninguna tabla `reserva`**, y en las
**22 pantallas** del frontend no hay ninguna de reservas. Lo que sí existe es un **carrito de compras**
(`/cart`) y una **tienda en línea** (`/store`) — que es otra cosa: el cliente compra y paga en el
momento, no "reserva para después".

Si dejás esa frase, la mesa te va a decir *"muéstreme las reservas"* y no las vas a poder mostrar.

👉 **Acción:** borrar la palabra "reservas" y reemplazarla por lo que sí existe. **O**, si el grupo
se encariñó con la idea, dejarla explícitamente como *trabajo futuro*, fuera del alcance.

Además, **las "dos fases" quedaron viejas**: el proyecto se ejecutó en **5 ciclos**.

### ✍️ Texto propuesto (reemplaza el apartado PROYECTO completo)

> El presente trabajo surge como respuesta a la necesidad de modernizar los procesos de gestión de
> inventario, ventas y crédito de Santa Cruz-Computer. El sistema reemplaza los registros manuales
> por una plataforma web integrada, desarrollada de manera **incremental en cinco ciclos**:
>
> | Ciclo | Alcance entregado |
> |---|---|
> | **1** | Seguridad y accesos: usuarios, roles y permisos (administrador, vendedor, técnico, cliente). |
> | **2** | Inventario: categorías, productos, stock en tiempo real y alertas de stock mínimo. |
> | **3** | Compras y ventas: proveedores, registro de compras, registro de ventas, facturación y bitácora de auditoría. |
> | **4** | Canal en línea: tienda web, carrito de compras, pago electrónico con tarjeta, garantías y reseñas. |
> | **5** | Servicios comerciales y financieros: **promociones programadas**, **venta a crédito** y **cartera de cobranza**. |
>
> Los ciclos 1 al 4 constituyen la **plataforma base** del sistema. El **ciclo 5**, objeto principal
> del presente documento, incorpora los tres módulos que formalizan la gestión comercial y financiera
> de la empresa.

> ✅ **Decisión tomada:** la fila del ciclo 5 lleva **únicamente mis tres módulos**. Lo que hicieron
> mis compañeros en el ciclo 5 (devoluciones, servicio técnico, notificaciones, chatbot) **existe en
> el sistema desplegado, pero queda deliberadamente fuera de este documento**, porque este documento
> presenta y defiende exclusivamente mi aporte.
>
> Si en la defensa alguien pregunta por esos módulos, la respuesta es simple y honesta: *"forman parte
> del sistema y fueron desarrollados por otros integrantes del grupo; el presente documento se
> circunscribe a los tres módulos de mi autoría"*.

---

# 4. Antecedente

### 🔍 Qué dice hoy

Menciona dos empresas comparables (**Netcrow** y **TecnoCompu**) y sostiene que comparten la misma
informalidad. Cierra diciendo que las empresas que implementaron sistemas mejoraron.

### ⚠️ Problema

Es **puramente narrativo**. Afirma que "las empresas con sistemas mejoraron notablemente" pero **no
aporta ni un dato ni una comparación**. La mesa puede preguntar: *"¿en qué se basa?"*.

La forma más barata de blindarlo es una **tabla comparativa** — y de paso te sirve para meter tu
tema.

### ✍️ Texto propuesto (agregar al final del Antecedente)

> **Comparación con empresas del rubro**
>
> | Aspecto | Netcrow | TecnoCompu | Santa Cruz-Computer (antes) | Con el sistema |
> |---|---|---|---|---|
> | Control de inventario | Hoja de cálculo | Manual | Manual / cuaderno | Stock en tiempo real |
> | Comprobante de venta | Nota manual | Nota manual | Nota manual | Factura digital |
> | Venta en línea | No | No | No | Tienda web con pago en línea |
> | ⭐ **Promociones** | **Verbales** | **Verbales** | **Verbales** | **Programadas, con vigencia y precio automático** |
> | ⭐ **Venta a crédito** | **Cuaderno** | **Cuaderno** | **Cuaderno** | **Plan de cuotas formal, con mora** |
> | ⭐ **Cartera de cobranza** | **No existe** | **No existe** | **No existe** | **Consolidado en tiempo real de la deuda** |
>
> Como se observa, la informalidad es transversal al rubro. **Ninguna de las empresas comparadas ha
> sistematizado la venta a crédito ni la gestión de su cartera**, a pesar de que constituye una parte
> relevante de sus ingresos. Allí radica la principal oportunidad de diferenciación del presente
> proyecto.

> 💡 Esta tabla es tu mejor arma: deja demostrado que **lo que vos hacés no lo hace nadie en el
> rubro**. Eso es exactamente lo que un tribunal considera "aporte". ⭐

---

# 5. Justificación

### 🔍 Qué dice hoy

Tres párrafos: (1) las limitaciones actuales justifican el sistema, (2) la automatización reduce
errores, (3) mejora la toma de decisiones. **Todos sobre inventario y ventas.**

### ⚠️ Problema — 🔴 **TU PARTE NO ESTÁ JUSTIFICADA**

La justificación **no dice ni una palabra** de por qué hacen falta las promociones, la venta a
crédito ni la cartera. Los tres párrafos que ya están son válidos (son de la base compartida, que
también es tuya) — pero **falta el tuyo**.

### ✍️ Texto propuesto (agregar como 4.º y 5.º párrafo)

> Un aspecto particularmente crítico, y hasta ahora sin ningún tipo de control, es la **venta a
> crédito**. Santa Cruz-Computer otorga facilidades de pago a clientes conocidos y anota la deuda en
> un cuaderno, sin criterios formales para decidir a quién se le otorga, sin cronograma de
> vencimientos y sin recargo alguno por atraso. El resultado es que **el propietario no puede
> responder con precisión a tres preguntas elementales de su propio negocio**: cuánto dinero se le
> debe en total, qué clientes están atrasados y cuánto espera cobrar el mes que viene. Las cuotas se
> cobran cuando el cliente aparece por el local, no cuando vencen. El capital queda inmovilizado en
> una deuda que nadie gestiona activamente, y las pérdidas por incobrables se descubren tarde, cuando
> ya no hay margen de acción.
>
> De manera análoga, las **promociones** se aplican verbalmente y a criterio de quien atiende. No
> existe registro de qué producto está en oferta, con qué descuento, ni desde y hasta cuándo. Esto
> provoca que un mismo producto pueda venderse a precios distintos el mismo día según quién lo
> atienda, impide evaluar si una promoción efectivamente incrementó las ventas y deja abierta la
> puerta a descuentos no autorizados que erosionan el margen sin que nadie lo advierta.
>
> Por ello, el sistema no se limita a digitalizar el inventario y las ventas. Incorpora un **módulo
> de promociones programadas** con vigencia y aplicación automática del precio, un **módulo de venta
> a crédito** que formaliza el otorgamiento y genera el plan de cuotas, y un **módulo de cartera de
> cobranza** que ofrece a la administración una visión consolidada y en tiempo real de la deuda por
> cobrar.

---

# 6. Descripción del problema

### 🔍 Qué dice hoy

La sección más larga del documento. Desarrolla: falta de sistema de inventario, imposibilidad de
generar reportes, problemas de compras y ventas, falta de comprobantes, ausencia de historial de
mantenimiento, errores humanos, falta de reportes consolidados, limitación de recursos humanos e
inseguridad de la información en papel.

### ⚠️ Problema 1 — 🔴 **HAY UN BLOQUE ENTERO DUPLICADO**

**Esto es lo primero que tenés que arreglar, y aplica a los tres integrantes.**

El texto que empieza en *"El mantenimiento y la gestión de componentes de computadoras constituyen un
aspecto fundamental…"* **aparece dos veces, palabra por palabra**, y con él **los diez párrafos
siguientes**:

1. "El mantenimiento y la gestión de componentes…" *(apertura)*
2. "Uno de los principales inconvenientes detectados…" *(inventario)*
3. "A la falta de actualización en tiempo real…" *(reportes)*
4. "El proceso de compras y ventas representa…"
5. "La ausencia de un sistema que registre las ventas…"
6. "El área de mantenimiento de computadoras presenta…"
7. "La gestión manual conlleva además una alta exposición a errores humanos…"
8. "La falta de reportes consolidados constituye otro problema crítico…"
9. "La problemática se intensifica debido a la limitación de recursos humanos…"
10. "Por otro lado, la seguridad de la información…"
11. "En su conjunto, todos estos factores evidencian…"

**Todo eso está escrito dos veces.** Es un error de copiar-pegar y **es lo primero que nota un
docente**, porque hace la sección ilegible y aparenta relleno.

👉 **Acción:** borrá la **segunda aparición completa** — desde la segunda vez que aparece *"El
mantenimiento y la gestión de componentes…"* hasta la segunda vez que aparece *"…afecta de manera
directa la experiencia del cliente"*. El párrafo que empieza con *"La implementación de un sistema
de información…"* **sí se conserva**: es el cierre y aparece una sola vez.

La sección se reduce a la mitad sin perder **nada** de contenido. **Avisale a tus compañeros.**

### ⚠️ Problema 2 — ⭐ **Faltan MIS dos problemas**

De los problemas que enumera, **ninguno es el mío**. Faltan:

| Problema ausente | Lo resuelve |
|---|---|
| **La venta a crédito se lleva en un cuaderno, sin criterios ni cronograma** | ⭐ CU21 — Venta a crédito |
| **Nadie sabe cuánto se debe ni quién está en mora** | ⭐ CU22 — Cartera de créditos |
| **Los descuentos se dan de palabra, sin vigencia ni registro** | ⭐ CU20 — Promociones |

### ✍️ Texto propuesto (agregar **antes** del párrafo de cierre)

> **El descontrol de la venta a crédito.** Un problema de particular gravedad, y hasta ahora
> invisibilizado, es la administración de las ventas a plazo. La empresa otorga crédito a clientes
> conocidos y anota la deuda en un cuaderno, sin ningún criterio formal para decidir a quién se le
> otorga y a quién no. No se calcula una cuota inicial proporcional al monto, no se establece un
> cronograma de vencimientos y no se aplica recargo alguno por atraso, de modo que **para el cliente
> resulta indiferente pagar a tiempo o pagar tarde**. Tampoco existe forma de saber si un cliente ya
> tiene otras deudas abiertas con la empresa: es perfectamente posible que se le otorgue un nuevo
> crédito a alguien que ya está en mora, simplemente porque nadie lo recuerda.
>
> **La ausencia de una cartera de cobranza.** Como consecuencia directa de lo anterior, la empresa no
> dispone de ninguna visión consolidada de su deuda por cobrar. Para saber cuánto dinero tiene en la
> calle, el propietario debería sumar a mano las anotaciones del cuaderno; para saber quién está
> atrasado, debería revisar fecha por fecha. En la práctica, **no lo hace**. Las cuotas se cobran
> cuando el cliente aparece por el local, y no cuando vencen. El capital de la empresa —que es
> limitado— queda inmovilizado en una deuda que nadie gestiona activamente, y las pérdidas por
> incobrables se descubren cuando ya es tarde para actuar.
>
> **La informalidad de las promociones.** En paralelo, los descuentos se aplican verbalmente y a
> criterio de quien atiende. No existe un registro de qué producto está en oferta, con qué porcentaje
> ni durante qué período. Esto genera que un mismo producto pueda venderse a precios distintos el
> mismo día según el vendedor, impide evaluar si la promoción efectivamente incrementó las ventas, y
> deja abierta la puerta a descuentos no autorizados que erosionan el margen sin que la administración
> lo advierta.

### ⚠️ Problema 3 — Sigue siendo demasiado larga

Aun **después** de borrar el duplicado, la sección es extensa y repetitiva (el argumento "no hay
reportes" aparece en tres párrafos distintos con distintas palabras).

**Sugerencia:** cerrala con una tabla-resumen. Es lo que la mesa va a mirar, y te sirve de guion:

> **Síntesis de la problemática**
>
> | # | Problema | Consecuencia | Módulo que lo resuelve |
> |---|---|---|---|
> | P1 | Inventario manual, sin stock en tiempo real | Ventas perdidas, quiebres de stock | Inventario |
> | P2 | Sin reportes consolidados | Decisiones sin datos | Reportes |
> | P3 | Ventas sin comprobante formal | Riesgo legal y contable | Ventas / Facturación |
> | P4 | Registros en papel, vulnerables | Pérdida de información | Todo el sistema |
> | P5 | Sin control de accesos | Manipulación indebida de datos | Seguridad / Bitácora |
> | **P6** ⭐ | **Descuentos verbales, sin vigencia ni registro** | **Precios inconsistentes, margen erosionado** | **Promociones** |
> | **P7** ⭐ | **Crédito en cuaderno, sin criterios ni mora** | **Otorgamiento a clientes ya morosos** | **Venta a crédito** |
> | **P8** ⭐ | **Sin visión de la deuda por cobrar** | **Capital inmovilizado, incobrables tardíos** | **Cartera de créditos** |

> 💡 Esta tabla es tu **guion de defensa**. Las tres últimas filas son tuyas y cada una tiene su CU.

---

# 7. Formulación del problema

### 🔍 Qué dice hoy

Tres párrafos que **describen** las deficiencias (inventario descontrolado, falta de facturación,
falta de categorización).

### ⚠️ Problema — 🟠 **NO FORMULA NADA**

Es un **error de método**, del tipo que se corrige en la mesa. Una *formulación del problema*
académicamente correcta es **una pregunta** (o una proposición única y precisa), no un resumen.
Lo que hay escrito es una **descripción del problema abreviada** — o sea, repite la sección anterior.

La estructura estándar es: **una pregunta general + preguntas específicas**, y esas preguntas deben
**corresponderse una a una con los objetivos**. Ese emparejamiento (problema ↔ objetivo) es
exactamente lo que un tribunal busca cuando revisa el capítulo 1.

Y, otra vez, **no menciona el crédito ni las promociones**. ⭐

### ✍️ Texto propuesto (reemplaza la sección completa)

> **Pregunta general**
>
> ¿De qué manera un sistema de información web puede optimizar la gestión de inventario, ventas y
> **crédito** de la empresa Santa Cruz-Computer, reduciendo los errores derivados del registro manual
> y proporcionando información oportuna y confiable para la toma de decisiones?
>
> **Preguntas específicas**
>
> 1. ¿Cómo mantener el stock de componentes actualizado en tiempo real y alertar oportunamente cuando
>    un producto alcanza su nivel mínimo?
> 2. ¿Cómo registrar formalmente las ventas y compras, garantizando la emisión de un comprobante
>    digital y la trazabilidad de cada operación?
> 3. ¿Cómo asegurar la información mediante control de acceso por rol y registro de auditoría?
> 4. ⭐ ¿Cómo administrar promociones con vigencia definida, de manera que el precio con descuento se
>    aplique de forma automática y uniforme en todos los canales de venta?
> 5. ⭐ ¿Cómo formalizar el otorgamiento de ventas a crédito, estableciendo criterios objetivos de
>    aprobación, un plan de cuotas verificable y un recargo por mora?
> 6. ⭐ ¿Cómo proporcionar a la administración una visión consolidada y en tiempo real de la deuda por
>    cobrar, identificando a los clientes en mora y proyectando la cobranza?

> 💡 **Truco de defensa:** las preguntas 4, 5 y 6 son **exactamente tus tres CU**, en orden. Y cada
> una va a tener su objetivo específico espejo en la sección siguiente. Eso es lo que hace que un
> capítulo 1 "cierre". ⭐

---

# 8. Objetivos

## 8.1 Objetivo General

### 🔍 Qué dice hoy

> "Desarrollar un sistema de información para la gestión de inventario, compra y venta para la
> empresa 'santa cruz-computer'."

### ⚠️ Problema

Tres cosas:

1. **Se quedó corto.** Dice "inventario, compra y venta". **Tus tres módulos no están.** La mesa lo
   lee y concluye: *"entonces las promociones y los créditos están fuera de objetivo"*. Es un regalo
   que le estarías haciendo. 🔴
2. **Errores de forma:** falta el espacio en `inventario,compra`, y el nombre de la empresa va con
   mayúsculas: **"Santa Cruz-Computer"**.
3. **No dice el para qué.** Un objetivo general cierra con el propósito, no solo con el artefacto.

### ✍️ Texto propuesto

> **Desarrollar e implementar un sistema de información web para la empresa Santa Cruz-Computer que
> integre la gestión de inventario, compras, ventas, promociones y créditos, con el fin de automatizar
> sus procesos operativos, garantizar la trazabilidad de la información y mejorar la toma de decisiones
> comerciales y financieras.**

## 8.2 Objetivos Específicos

### 🔍 Qué dicen hoy

1. Recolectar información sobre los procesos actuales.
2. Analizar los datos para definir requisitos.
3. Diseñar una base de datos relacional en PostgreSQL.
4. Elaborar diagramas en **StarUML**.
5. Implementar el sistema con React, Python y Django.

### ⚠️ Problemas

- ⚠️ **"Elaborar diagramas en StarUML"** — ¿**realmente usaron StarUML**? Si los diagramas los hicieron
  con otra herramienta, esto es una afirmación falsa y es fácil de detectar: **la mesa pide el archivo
  `.mdj`**. **Verificalo con tu grupo.** Si no lo usaron, poné "elaborar los diagramas UML del sistema"
  sin atarte a una herramienta.
- 🔴 ⭐ **No hay ningún objetivo sobre promociones ni créditos.** Tu parte, otra vez, sin respaldo.
- ⚠️ **No hay objetivo de despliegue ni de validación.** El sistema está publicado y funcionando —
  eso **es un mérito**, pero si no está como objetivo, no cuenta.
- ⚠️ **No hay objetivo de seguridad**, aunque implementaron roles, JWT y bitácora.

### ✍️ Texto propuesto (reemplaza la lista completa)

> 1. **Recolectar** información sobre los procesos actuales de inventario, ventas y **otorgamiento de
>    crédito** de la empresa, con el fin de identificar sus limitaciones y necesidades.
> 2. **Analizar** los datos recopilados para definir los requisitos funcionales y no funcionales que
>    debe cumplir el sistema.
> 3. **Diseñar** una base de datos relacional en PostgreSQL que soporte de manera íntegra el inventario,
>    las transacciones comerciales y **los planes de crédito con su cronograma de cuotas**.
> 4. **Elaborar** los diagramas UML del sistema (casos de uso, entidad-relación, clases, secuencia y
>    estados) que representen su estructura y comportamiento.
> 5. **Implementar** el sistema utilizando React con TypeScript en el frontend y Python con Django REST
>    Framework en el backend.
> 6. ⭐ **Incorporar** un módulo de **promociones programadas** con vigencia definida y aplicación
>    automática del precio con descuento en todos los canales de venta.
> 7. ⭐ **Incorporar** un módulo de **venta a crédito** que formalice el otorgamiento mediante criterios
>    objetivos de aprobación, genere automáticamente el plan de cuotas y aplique el recargo por mora.
> 8. ⭐ **Implementar** una **cartera de cobranza** que consolide en tiempo real la deuda por cobrar,
>    identifique a los clientes en mora y proyecte los ingresos por vencimientos próximos.
> 9. **Garantizar** la seguridad de la información mediante autenticación, control de acceso por roles
>    y una bitácora de auditoría de las operaciones críticas.
> 10. **Desplegar** el sistema en un entorno productivo accesible vía web y **validar** su funcionamiento
>    mediante casos de prueba.

> 💡 Los objetivos **6, 7 y 8 son el espejo exacto** de las preguntas 4, 5 y 6 de la formulación.
> Pregunta → objetivo → caso de uso → pantalla. Esa cadena completa es lo que te va a salvar en la
> defensa. ⭐

---

# 9. Alcance

### 🔍 Qué dice hoy

Seis módulos: **Usuarios · Inventario · Compras · Ventas · Reportes · Movimientos de stock**.

### ⚠️ Problema A — 🔴 **PROMETE TRES COSAS QUE NO EXISTEN**

Esto es lo más peligroso: **prometer de más**. Lo verifiqué tabla por tabla contra la base de datos.

| El alcance dice… | Realidad |
|---|---|
| *"Seguimiento de Números de Serie: **registro obligatorio** de los números de serie de los componentes críticos"* | ❌ **No existe.** No hay ninguna columna de número de serie en `producto`, `compra` ni `detallecompra`. |
| *"**MÓDULO MOVIMIENTOS DE STOCK** — Registro de movimientos… **Consulta de Kardex** básico"* | ❌ **No existe como módulo.** No hay tabla de movimientos ni Kardex. El stock se actualiza directamente sobre `producto`, y la trazabilidad se obtiene indirectamente por `detalleventa` / `detallecompra` y la `bitacora`. |
| *"Módulo de **reservas**"* (en la sección Proyecto) | ❌ **No existe.** No hay tabla `reserva`. |

👉 **Acción obligatoria:** o **las borrás**, o **las implementás**. No hay tercera opción — si la mesa
las lee, las va a pedir. **Mi recomendación: borrarlas** y, si querés, mencionarlas como *trabajo futuro*.

### ⚠️ Problema B — El alcance omite módulos de la **base compartida** que sí existen

Estos **también son tuyos** (son CU1–19, los presentás igual que tus compañeros), y sin embargo el
alcance no los menciona:

| Módulo real | Evidencia (tablas) | Pantalla |
|---|---|---|
| **Tienda en línea y carrito** | *(sesión)* | `/store`, `/cart` |
| **Pagos electrónicos y facturación** | `pagoventa`, `factura` | `/payment-success` |
| **Garantías** | `garantia` | `/warranties` |
| **Reseñas** | `resena` | `/reviews` |
| **Bitácora / auditoría** | `bitacora` | `/audit-log` |

### ⚠️ Problema C — ⭐ **Faltan MIS TRES MÓDULOS**

Ni promociones, ni créditos, ni cartera. **Este es el hueco que tenés que tapar sí o sí.**

> **Nota importante:** lo que el alcance actual llama *"Gestión de descuentos"* (dentro del módulo
> Ventas) **es, en realidad, tu módulo de Promociones** — solo que mal nombrado y sin la noción de
> vigencia. Conviene **sacarlo de Ventas** y darle su propio módulo, que es lo que realmente es.

### ✍️ Texto propuesto — módulos a agregar al Alcance

*(Con el mismo formato de los módulos que ya están. Los tres con ⭐ son los que defiendo yo.)*

> **MÓDULO TIENDA EN LÍNEA**
> - **Catálogo público:** visualización de los productos disponibles con precio, imagen y stock,
>   accesible sin iniciar sesión.
> - **Carrito de compras:** el cliente agrega productos, modifica cantidades y visualiza el total
>   antes de confirmar. El carrito se mantiene aislado por sesión de usuario.
> - **Checkout:** confirmación del pedido, elección del método de pago y generación de la venta.
>
> **MÓDULO PAGOS Y FACTURACIÓN**
> - **Pago electrónico con tarjeta:** integración con una pasarela de pagos para el cobro en línea,
>   con registro del identificador de la transacción.
> - **Pago en efectivo:** registro del cobro presencial por parte del vendedor.
> - **Factura digital:** generación automática del comprobante al confirmarse el pago.
>
> **MÓDULO POSVENTA**
> - **Garantías:** registro de la garantía de cada producto vendido, con su fecha de vencimiento y
>   estado (vigente, vencida, anulada), consultable por el cliente.
> - **Reseñas:** el cliente califica los productos que compró; el administrador modera las reseñas
>   antes de su publicación.
>
> **MÓDULO SEGURIDAD Y AUDITORÍA**
> - **Autenticación:** inicio de sesión con credenciales y expiración automática de la sesión por
>   inactividad.
> - **Control de acceso por rol:** cada rol (administrador, vendedor, técnico, cliente) accede
>   únicamente a las funciones que le corresponden.
> - **Bitácora:** registro de las operaciones críticas del sistema (quién, qué y cuándo).
>
> ⭐ **MÓDULO PROMOCIONES** *(CU20)*
> - **Gestión de promociones:** creación de promociones sobre un producto, indicando el porcentaje de
>   descuento y su período de vigencia (fecha de inicio y fecha de fin).
> - **Aplicación automática del precio:** durante la vigencia, el precio promocional se calcula y se
>   muestra automáticamente en todos los canales de venta (tienda en línea y venta presencial), sin
>   intervención del vendedor.
> - **Control de vigencia:** al expirar la fecha de fin, el producto retorna automáticamente a su
>   precio regular, sin necesidad de ninguna acción manual.
>
> ⭐ **MÓDULO VENTA A CRÉDITO** *(CU21)*
> - **Registro de ventas a crédito:** tanto para clientes de la tienda en línea como para clientes
>   presenciales, con cálculo automático de la cuota inicial y generación del plan de cuotas.
> - **Evaluación crediticia:** verificación de los requisitos del cliente mediante un checklist, y
>   validación automática de que no registre cuotas vencidas ni exceda el número máximo de créditos
>   activos permitidos.
> - **Cobranza de cuotas:** registro del pago de cada cuota, en efectivo o con tarjeta, con emisión
>   del comprobante correspondiente.
> - **Recargo por mora:** aplicación automática del recargo sobre las cuotas vencidas.
> - **Consulta del cliente:** el cliente accede a sus créditos, ve su cronograma de cuotas y paga en
>   línea las que estén pendientes.
>
> ⭐ **MÓDULO CARTERA DE CRÉDITOS** *(CU22)*
> - **Consolidado de la deuda:** visualización en tiempo real del total otorgado, el total cobrado y
>   el saldo pendiente por cobrar.
> - **Clientes en mora:** identificación de los clientes con cuotas vencidas y del monto adeudado por
>   cada uno.
> - **Proyección de cobranza:** estimación de los ingresos esperados según los vencimientos próximos.
> - **Bloqueo automático:** un cliente con cuotas vencidas queda inhabilitado para recibir nuevos
>   créditos.

---

# 10. Anexo — Tabla de trazabilidad (tu red de seguridad en la defensa)

Conecta **cada módulo** con **su caso de uso**, **su tabla** y **su pantalla**. Si la mesa pregunta
*"¿dónde está implementado esto?"*, señalás la fila.

## Base compartida (CU1–CU19) — la presentamos los tres

| Módulo | CU | Tablas | Pantalla |
|---|---|---|---|
| Usuarios y seguridad | CU1–CU4 | `usuario`, `cliente` | `/users`, `/login`, `/admin-panel` |
| Inventario | CU5–CU8, CU10 | `producto`, `categoria` | `/products`, `/inventory` |
| Compras | CU12, CU14 | `proveedor`, `compra`, `detallecompra` | `/suppliers` |
| Ventas y carrito | CU9, CU15 | `venta`, `detalleventa` | `/sales`, `/store`, `/cart` |
| Pagos y facturación | CU11, CU17 | `pagoventa`, `factura` | `/payment-success` |
| Reportes | CU13 | *(consultas)* | `/dashboard`, `/sales-history` |
| Auditoría | CU16 | `bitacora` | `/audit-log` |
| Garantías | CU18 | `garantia` | `/warranties` |
| Reseñas | CU19 | `resena` | `/reviews` |

## ⭐ Mi aporte (Ciclo 5)

| Módulo | Mi CU | CU del grupo | Tablas | Pantalla |
|---|---|---|---|---|
| **Promociones programadas** | **CU20** | CU24 | `promocion` | `/promociones` |
| **Venta a crédito** | **CU21** | CU28 | `plan_credito`, `cuota`, `checklist_credito` | `/creditos`, `/mis-creditos` |
| **Cartera de créditos** | **CU22** | CU29 | *(ninguna propia — agrega sobre `plan_credito` y `cuota`)* | `/creditos` → pestaña Cartera |

> ⚠️ **Ojo con la última fila.** La Cartera **no tiene tablas propias**: es una vista consolidada que
> se calcula sobre `plan_credito` y `cuota`. Es una decisión de diseño correcta, **pero te la van a
> preguntar**. La respuesta está abajo, y en detalle en `Documento_ciclo5.md`.

## Fuera de mi documento (Ciclo 5 de mis compañeros)

Chatbot de IA · Notificaciones · Recibo y factura por correo · Devoluciones (RMA) · Servicio técnico
preventivo, correctivo e historial.

> No los incluyo en mi alcance, mi problema ni mis objetivos. **Si alguno aparece en tu Word,
> borralo** — o te van a preguntar por algo que no desarrollaste vos.

---

# 11. Lo que te va a preguntar la mesa ⭐

Estas preguntas salen solas al leer tus tres casos de uso. Tenelas listas:

1. **"¿Por qué la Cartera no tiene tablas propias?"**
   → Porque es información **derivada**. Guardar el saldo pendiente en una tabla sería duplicar un
   dato que ya se puede calcular sumando las cuotas impagas; si los dos valores se desincronizan,
   tenés una base de datos que se contradice a sí misma. Se calcula al momento de consultarla.

2. **"¿Cómo decide el sistema si un cliente merece crédito?"**
   → Por un **checklist de requisitos** más **dos validaciones automáticas**: que no tenga cuotas
   vencidas y que no supere el máximo de créditos activos simultáneos.

3. **"¿La mora se cobra por cada día de atraso?"**
   → ⚠️ **Cuidado con esta.** En el código, el recargo es un porcentaje que se aplica **una sola vez**
   sobre la cuota vencida; **no se acumula día a día**. Tenés que decidir si eso es lo que quiere el
   negocio (y defenderlo así) o si conviene corregirlo antes de presentar. **Es el tema pendiente
   número uno.**

4. **"¿Qué pasa si el sistema falla a la mitad de registrar una venta a crédito?"**
   → No queda nada a medias: la venta, el plan y las cuotas se crean dentro de **una única transacción
   atómica**. O se hace todo, o no se hace nada.

5. **"¿El precio con descuento se guarda o se calcula?"**
   → Se **calcula** al mostrar el producto, comparando la fecha actual contra la vigencia de la
   promoción. Por eso cuando la promoción expira, el precio vuelve solo a su valor normal, sin que
   nadie tenga que hacer nada.

---

## Checklist de correcciones para tu Word

**Errores del documento base — avisale también a tus compañeros:**
- [ ] 🔴 Borrar el **bloque duplicado** de la Descripción del problema
- [ ] 🔴 Eliminar el **módulo de reservas** (no existe)
- [ ] 🔴 Eliminar **números de serie** y **Kardex** del Alcance (no existen)
- [ ] 🟠 Verificar si **realmente usaron StarUML**
- [ ] 🟡 Corregir `inventario,compra` → `inventario, compra` y `santa cruz-computer` → `Santa Cruz-Computer`

**Lo tuyo — sin esto, tus 3 CU quedan sin respaldo:**
- [ ] ⭐ Agregar los **3 párrafos del problema** (crédito, cartera, promociones)
- [ ] ⭐ Agregar los **3 párrafos de la justificación**
- [ ] ⭐ Reescribir la **Formulación** como preguntas (las 4, 5 y 6 son tuyas)
- [ ] ⭐ Ampliar el **Objetivo General** para que incluya promociones y créditos
- [ ] ⭐ Agregar los **objetivos específicos 6, 7 y 8**
- [ ] ⭐ Agregar al Alcance los **3 módulos** (Promociones, Venta a crédito, Cartera)
- [ ] ⭐ Sacar *"Gestión de descuentos"* de Ventas → es tu módulo de Promociones
- [ ] 🟡 Agregar los módulos de la **base compartida** que faltan (tienda, pagos, garantías, reseñas, bitácora)
- [ ] 🟡 Definir **misión y visión** explícitas
- [ ] 🔴 **Quitar** de tu documento cualquier mención a devoluciones, servicio técnico, notificaciones
      o chatbot — **eso es de tus compañeros**
