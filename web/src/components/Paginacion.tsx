import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Paginacion.module.css';

const TAMANO_ICONO = 16;

interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
}

/** Flechas compactas + "página / total", para el pie de una card de tabla.
 *  El recuento completo lo pone quien la usa, al lado. */
export function Paginacion({ pagina, totalPaginas, onCambiar }: PaginacionProps) {
  return (
    <nav className={styles.paginacion} aria-label="Paginación">
      <button
        type="button"
        className={styles.flecha}
        aria-label="Página anterior"
        disabled={pagina <= 1}
        onClick={() => onCambiar(pagina - 1)}
      >
        <ChevronLeft size={TAMANO_ICONO} aria-hidden />
      </button>
      <span className={styles.estado}>
        {pagina} / {totalPaginas}
      </span>
      <button
        type="button"
        className={styles.flecha}
        aria-label="Página siguiente"
        disabled={pagina >= totalPaginas}
        onClick={() => onCambiar(pagina + 1)}
      >
        <ChevronRight size={TAMANO_ICONO} aria-hidden />
      </button>
    </nav>
  );
}
