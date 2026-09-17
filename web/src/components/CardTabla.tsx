import type { ReactNode } from 'react';
import styles from './CardTabla.module.css';

interface CardTablaProps {
  /** Texto del pie a la izquierda: recuento y qué hace clickear una fila. */
  pie?: ReactNode;
  /** Texto del pie a la derecha: nota de lectura de la tabla. */
  pieDerecha?: ReactNode;
  /** Controles del pie a la derecha (paginación); mandan sobre `pieDerecha`. */
  acciones?: ReactNode;
  children: ReactNode;
}

/** Card de listado: la tabla scrollea adentro y el pie queda fijo al borde
 *  inferior, en vez de empujar el documento. */
export function CardTabla({ pie, pieDerecha, acciones, children }: CardTablaProps) {
  const hayPie = pie || pieDerecha || acciones;
  return (
    <div className={styles.cardTabla}>
      <div className={styles.tablaScroll}>{children}</div>
      {hayPie && (
        <div className={styles.pieCard}>
          {pie && <span className={styles.pieTexto}>{pie}</span>}
          {acciones ?? (pieDerecha && <span className={styles.pieTexto}>{pieDerecha}</span>)}
        </div>
      )}
    </div>
  );
}
