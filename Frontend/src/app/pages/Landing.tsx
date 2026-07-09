/**
 * Landing.tsx — Página de inicio pública (ruta /)
 *
 * La ve todo visitante (logueado o no). Presenta la propuesta de valor de
 * Santa Cruz Computer: catálogo, crédito propio, servicio técnico y VIP.
 *
 * Comportamiento del hero según sesión:
 *   • Sin login: CTAs "Ver catálogo" y "Iniciar sesión".
 *   • Logueado: además del catálogo, "Ir a mi panel" a la ruta que
 *     corresponda al rol (admin/employee/tecnico/client).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  MapPin, Phone, Clock, Mail,
  CreditCard, Wrench, Crown, ShieldCheck,
  Banknote, QrCode, Package, Store as StoreIcon,
  ChevronRight, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { productosAPI, categoriasAPI, ApiProduct, ApiCategoria } from '../services/api';

// Datos fijos del negocio (los mismos que aparecen en la factura HTML del crédito)
const EMPRESA = {
  nombre:    'Santa Cruz Computer',
  nit:       '1234567019',
  direccion: 'Av. Cristo Redentor #123, Santa Cruz de la Sierra',
  ciudad:    'Santa Cruz de la Sierra, Bolivia',
  telefono:  '+591 3 344 5566',
  correo:    'ventas@santacruzcomputer.bo',
  horario:   'Lun–Sáb 9:00–18:00',
};

// Ruta del panel post-login para cada rol (misma tabla que Login.tsx)
const rutaPanel = (role?: string) => (
  role === 'admin'    ? '/dashboard'    :
  role === 'employee' ? '/inventory'    :
  role === 'tecnico'  ? '/mis-trabajos' :
  role === 'client'   ? '/store'        :
                        '/login'
);

const bs = (x: number | string) => `Bs ${Number(x).toFixed(2)}`;

// Shuffle Fisher–Yates para elegir 6 destacados al azar. Se ejecuta una sola vez
// por carga de página, así cada visitante ve un catálogo distinto.
const shuffle = <T,>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function Landing() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<ApiProduct[]>([]);
  const [categorias, setCategorias] = useState<ApiCategoria[]>([]);
  const [categoriaSel, setCategoriaSel] = useState<number | ''>('');
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    Promise.all([productosAPI.getAll(), categoriasAPI.getAll()])
      .then(([ps, cs]) => { setProductos(ps); setCategorias(cs); })
      .catch(() => {});
  }, []);

  // Cuando no hay categoría → 10 aleatorios de todo el stock.
  // Cuando hay categoría → 10 aleatorios dentro de esa categoría.
  // 10 llena 2 filas de 5 en desktop XL, o 2.5 filas en laptop (grid-cols-4).
  const destacados = useMemo(() => {
    const conStock = productos.filter(p => (p.stock ?? 0) > 0);
    const pool = categoriaSel === '' ? conStock : conStock.filter(p => p.categoria === categoriaSel);
    return shuffle(pool).slice(0, 10);
  }, [productos, categoriaSel]);

  return (
    <div className="bg-white text-gray-900">
      {/* ── Nav sticky (con menú hamburguesa en móvil) ─────────────────────── */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-2">
            <img src="/logo.png" alt="Santa Cruz Computer" className="h-9 w-auto object-contain" />
            <span className="font-bold text-gray-900 hidden sm:inline">Santa Cruz Computer</span>
          </a>
          {/* Links visibles solo desde md+ */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <a href="#catalogo" className="text-gray-600 hover:text-blue-700">Catálogo</a>
            <a href="#servicios" className="text-gray-600 hover:text-blue-700">Servicio técnico</a>
            <a href="#creditos" className="text-gray-600 hover:text-blue-700">Créditos</a>
            <a href="#ubicacion" className="text-gray-600 hover:text-blue-700">Ubicación</a>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to={rutaPanel(user.role)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                Ir a mi panel <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" state={{ initialView: 'register' }}
                  className="hidden sm:inline-flex items-center px-3 py-2 text-sm text-blue-700 hover:underline font-medium">
                  Crear cuenta
                </Link>
                <Link to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  Iniciar sesión
                </Link>
              </>
            )}
            {/* Botón hamburguesa — solo visible por debajo de md */}
            <button onClick={() => setMenuAbierto(!menuAbierto)}
              className="md:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900"
              aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}>
              {menuAbierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {/* Panel del hamburguesa (dropdown) */}
        {menuAbierto && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col">
              {[
                ['#catalogo',  'Catálogo'],
                ['#servicios', 'Servicio técnico'],
                ['#creditos',  'Créditos'],
                ['#ubicacion', 'Ubicación'],
              ].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMenuAbierto(false)}
                  className="py-3 border-b border-gray-100 text-gray-700 hover:text-blue-700 text-sm font-medium">
                  {label}
                </a>
              ))}
              {!user && (
                <Link to="/login" state={{ initialView: 'register' }}
                  onClick={() => setMenuAbierto(false)}
                  className="py-3 text-blue-700 text-sm font-medium">
                  Crear cuenta
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ── Productos destacados (ahora arriba, entrada directa a la tienda) ── */}
      <section id="catalogo" className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Productos destacados</h2>
              <p className="text-gray-600 mt-1">Algo de lo que tenemos en stock ahora mismo.</p>
            </div>
            <Link to={user ? '/store' : '/login'}
              className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium">
              Ver catálogo completo <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Filtro por categoría — mismo patrón que /sales, mucho más limpio que los chips */}
          {categorias.length > 0 && (
            <div className="flex items-center gap-2 mb-6 max-w-sm">
              <label className="text-sm text-gray-600 shrink-0">Categoría:</label>
              <select value={categoriaSel}
                onChange={e => setCategoriaSel(e.target.value ? parseInt(e.target.value) : '')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="">Todas las categorías</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {destacados.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
              No hay productos disponibles en esta categoría por ahora.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {destacados.map(p => (
                <Link key={p.id} to={user ? '/store' : '/login'}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-white flex items-center justify-center overflow-hidden border-b border-gray-100">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.name}
                        className="w-full h-full object-contain p-2"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <Package className="w-16 h-16 text-blue-200" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{p.name}</p>
                    <p className="text-xs text-gray-500 mb-2">{p.marca || 'Sin marca'}</p>
                    <p className="text-lg font-bold text-blue-700">{bs(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 4 diferenciales (ahora debajo de productos como refuerzo) ─────── */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Por qué comprar acá</h2>
          <p className="text-gray-600 mt-1">Cuatro cosas que nos hacen distintos.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: CreditCard,  color: 'text-indigo-600', bg: 'bg-indigo-50',
              titulo: 'Crédito propio',
              texto:  'Compra en hasta 12 cuotas sin banco. Aprobamos en la tienda con tu CI y documentos básicos.' },
            { icon: Wrench,      color: 'text-emerald-600', bg: 'bg-emerald-50',
              titulo: 'Servicio técnico',
              texto:  'Mantenimiento preventivo y correctivo con checklist. Si tu equipo tiene garantía vigente, hay usos GRATIS.' },
            { icon: Crown,       color: 'text-amber-600', bg: 'bg-amber-50',
              titulo: 'Programa VIP',
              texto:  'Cada Bs 200 de consumo suman descuento para tu próxima compra. Automático, sin trámite.' },
            { icon: StoreIcon,   color: 'text-blue-600', bg: 'bg-blue-50',
              titulo: 'Compra online y retiro',
              texto:  'Pagá con tarjeta desde tu perfil y retirá el producto en la tienda cuando te llegue el aviso.' },
          ].map(b => (
            <div key={b.titulo} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className={`w-11 h-11 rounded-lg ${b.bg} ${b.color} flex items-center justify-center mb-3`}>
                <b.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{b.titulo}</h3>
              <p className="text-sm text-gray-600">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona el crédito ───────────────────────────────────────── */}
      <section id="creditos" className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <CreditCard className="w-7 h-7 text-indigo-600" /> Cómo funciona el crédito
          </h2>
          <p className="text-gray-600 mt-1 max-w-2xl mx-auto">
            El plan se decide según el precio del producto. Todo transparente, sin costos ocultos.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { rango: 'Bs 1 – 5.000',      cuotas: '6 cuotas',  recargo: '+20%', color: 'from-indigo-500 to-indigo-600' },
            { rango: 'Bs 5.001 – 10.000', cuotas: '9 cuotas',  recargo: '+25%', color: 'from-blue-500 to-blue-600' },
            { rango: 'Bs 10.001 – 15.000',cuotas: '12 cuotas', recargo: '+30%', color: 'from-sky-500 to-sky-600' },
          ].map(r => (
            <div key={r.rango} className="rounded-xl overflow-hidden border border-gray-200">
              <div className={`bg-gradient-to-r ${r.color} text-white px-4 py-3`}>
                <p className="text-xs uppercase tracking-wider opacity-90">Precio del producto</p>
                <p className="text-lg font-bold">{r.rango}</p>
              </div>
              <div className="p-4 bg-white text-center">
                <p className="text-3xl font-bold text-gray-900">{r.cuotas}</p>
                <p className="text-sm text-gray-500 mb-2">mensuales</p>
                <p className="text-sm font-semibold text-indigo-700">Recargo {r.recargo}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mt-6">
          <p className="text-sm text-indigo-900 leading-relaxed">
            <strong>Inicial:</strong> 20% del total financiado, se paga en la tienda al firmar el crédito.
            El producto se entrega el mismo día. El saldo se paga en cuotas mensuales fijas.
            <br />
            <strong>Requisitos:</strong> CI del solicitante, factura de servicios básicos y prueba de ingresos
            (boletas de pago o facturas del último año, según el tipo de empleo). Antigüedad laboral mínima
            de 12 meses.
            <br />
            <strong>Mora:</strong> una cuota vencida suma un recargo del 10% y bloquea la posibilidad de tomar
            nuevos créditos hasta regularizar.
          </p>
        </div>
      </section>

      {/* ── Servicio técnico ───────────────────────────────────────────────── */}
      <section id="servicios" className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <Wrench className="w-7 h-7 text-emerald-600" /> Servicio técnico
            </h2>
            <p className="text-gray-600 mt-1">Con checklist, garantía y aviso por correo cuando esté listo.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> Mantenimiento preventivo
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Laptop: {bs(200)}</li>
                <li>• Escritorio: {bs(250)}</li>
                <li className="text-emerald-700 font-medium">
                  • <strong>GRATIS</strong> para laptops con garantía vigente (2 usos, cada 6 meses)
                </li>
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                Incluye limpieza física, cambio de pasta térmica, actualización de firmware, revisión
                de disco y checklist de estado del equipo.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Wrench className="w-5 h-5 text-emerald-600" /> Servicio correctivo
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Limpieza de virus y malware: {bs(100)}</li>
                <li>• Formateo e instalación: {bs(150)}</li>
                <li>• Recuperación de datos: desde {bs(300)}</li>
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                Se pueden combinar varios servicios en una misma orden. El técnico agenda una fecha
                de retiro y te avisa por correo cuando el equipo esté listo — incluso si se termina
                antes de la fecha acordada.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Formas de pago ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Formas de pago</h2>
          <p className="text-gray-600 mt-1">
            En la tienda pagás con efectivo o QR. Online, con tarjeta desde tu perfil.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-2">
              <Banknote className="w-6 h-6" />
            </div>
            <p className="font-semibold text-gray-900">Efectivo</p>
            <p className="text-xs text-gray-500 mt-1">Pago presencial en la tienda</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
              <QrCode className="w-6 h-6" />
            </div>
            <p className="font-semibold text-gray-900">QR</p>
            <p className="text-xs text-gray-500 mt-1">Pago presencial con billetera digital</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <CreditCard className="w-6 h-6" />
            </div>
            <p className="font-semibold text-gray-900">Tarjeta (online)</p>
            <p className="text-xs text-gray-500 mt-1">Desde tu perfil, con Stripe seguro</p>
          </div>
        </div>
      </section>

      {/* ── Ubicación ──────────────────────────────────────────────────────── */}
      <section id="ubicacion" className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
              <MapPin className="w-7 h-7 text-red-600" /> Dónde estamos
            </h2>
            <p className="text-gray-600 mt-1">Vení a la tienda o comunicate por los canales de siempre.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl overflow-hidden border border-gray-200 aspect-video">
              <iframe
                title="Ubicación de Santa Cruz Computer"
                src="https://www.google.com/maps?q=Santa+Cruz+de+la+Sierra,+Bolivia&output=embed"
                width="100%" height="100%"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                style={{ border: 0 }}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Dirección</p>
                  <p className="text-gray-600">{EMPRESA.direccion}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Horario</p>
                  <p className="text-gray-600">{EMPRESA.horario}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Teléfono</p>
                  <p className="text-gray-600">{EMPRESA.telefono}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">Correo</p>
                  <p className="text-gray-600">{EMPRESA.correo}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-blue-900 text-blue-100 text-sm">
        <div className="max-w-6xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo.png" alt="" className="h-9 w-auto object-contain" />
              <span className="font-bold text-white">{EMPRESA.nombre}</span>
            </div>
            <p className="text-blue-200 text-xs">NIT {EMPRESA.nit}</p>
            <p className="text-blue-200 text-xs">{EMPRESA.direccion}</p>
          </div>
          <div>
            <p className="text-white font-semibold mb-2">Enlaces</p>
            <ul className="space-y-1 text-xs">
              <li><a href="#catalogo" className="hover:underline">Catálogo</a></li>
              <li><a href="#servicios" className="hover:underline">Servicio técnico</a></li>
              <li><a href="#creditos" className="hover:underline">Créditos</a></li>
              <li><a href="#ubicacion" className="hover:underline">Ubicación</a></li>
            </ul>
          </div>
          <div>
            <p className="text-white font-semibold mb-2">Contacto</p>
            <p className="text-xs">{EMPRESA.telefono}</p>
            <p className="text-xs">{EMPRESA.correo}</p>
            <p className="text-xs mt-2 text-blue-200">{EMPRESA.horario}</p>
          </div>
        </div>
        <div className="border-t border-blue-800">
          <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-blue-300 text-center">
            © {new Date().getFullYear()} {EMPRESA.nombre}. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
