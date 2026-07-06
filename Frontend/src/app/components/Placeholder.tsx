/**
 * Placeholder.tsx — Página "Próximamente" reutilizable.
 * Se usa para las secciones del técnico mientras se construye su contenido real.
 */
import { Wrench } from 'lucide-react';

export function Placeholder({ title, descripcion }: { title: string; descripcion?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
        <Wrench className="w-8 h-8 text-blue-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 max-w-sm">{descripcion ?? 'Esta sección estará disponible pronto.'}</p>
    </div>
  );
}
