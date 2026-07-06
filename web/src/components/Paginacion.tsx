import { Button } from './Button';
import styles from './Paginacion.module.css';

interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  /** Cantidad total de ítems en todas las páginas. */
  total: number;
  /** Sustantivo plural de lo paginado, p.ej. "árboles". */
  etiqueta: string;
  onCambiar: (pagina: number) => void;
}

/** Controles Anterior/Siguiente con el estado "página X de Y · total N". */
export function Paginacion({ pagina, totalPaginas, total, etiqueta, onCambiar }: PaginacionProps) {
  return (
    <nav className={styles.paginacion} aria-label="Paginación">
      <Button
        variant="secondary"
        size="sm"
        disabled={pagina <= 1}
        onClick={() => onCambiar(pagina - 1)}
      >
        Anterior
      </Button>
      <span className={styles.estado}>
        Página {pagina} de {totalPaginas} · total {total} {etiqueta}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={pagina >= totalPaginas}
        onClick={() => onCambiar(pagina + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}
