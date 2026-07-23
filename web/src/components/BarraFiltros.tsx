import type { ReactNode } from 'react';
import styles from './BarraFiltros.module.css';

/** Barra de filtros estándar de los listados: una fila de controles con el
 *  estilo base de Input/Select (referencia: la búsqueda de Especies). */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return <div className={styles.barra}>{children}</div>;
}
