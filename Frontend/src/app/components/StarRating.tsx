/**
 * StarRating.tsx - Estrellas reutilizable
 *
 * - Modo lectura (sin onChange): muestra el promedio/puntuación.
 * - Modo interactivo (con onChange): el usuario hace clic para puntuar 1-5.
 */
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}

export function StarRating({ value, onChange, size = 20, readOnly = false }: StarRatingProps) {
  const interactive = !!onChange && !readOnly;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => {
        const filled = i <= Math.round(value);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i)}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
            aria-label={`${i} estrella${i === 1 ? '' : 's'}`}
          >
            <Star
              style={{ width: size, height: size }}
              className={filled ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
            />
          </button>
        );
      })}
    </div>
  );
}
