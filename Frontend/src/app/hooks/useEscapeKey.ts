/**
 * useEscapeKey.ts - Cerrar modales con la tecla Esc
 *
 * Registra un listener de teclado mientras `active` sea true y ejecuta
 * `onEscape` al presionar Escape. Se usa en cada modal para que, además
 * del botón "X", se pueda salir con Esc de forma consistente en toda la app.
 *
 * Uso:
 *   useEscapeKey(!!selectedOrder, () => setSelectedOrder(null));
 */
import { useEffect, useRef } from 'react';

export function useEscapeKey(active: boolean, onEscape: () => void) {
  const cb = useRef(onEscape);
  cb.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cb.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);
}
