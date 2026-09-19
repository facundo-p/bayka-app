import { useRef, type ReactNode } from 'react';
import { useIndicioDesborde } from '../hooks/useIndicioDesborde';
import { cx } from '../lib/classNames';
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
 *  inferior, en vez de empujar el documento. Cuando la tabla no entra a lo
 *  ancho, un degradado en el borde avisa que hay más columnas (#368). */
export function CardTabla({ pie, pieDerecha, acciones, children }: CardTablaProps) {
  const hayPie = pie || pieDerecha || acciones;
  const scrollRef = useRef<HTMLDivElement>(null);
  const desborde = useIndicioDesborde(scrollRef);
  return (
    <div className={styles.cardTabla}>
      <div
        className={cx(
          styles.marco,
          desborde.izquierda && styles.masALaIzquierda,
          desborde.derecha && styles.masALaDerecha,
        )}
      >
        <div className={styles.tablaScroll} ref={scrollRef}>
          {children}
        </div>
      </div>
      {hayPie && (
        <div className={styles.pieCard}>
          {pie && <span className={styles.pieTexto}>{pie}</span>}
          {acciones ?? (pieDerecha && <span className={styles.pieTexto}>{pieDerecha}</span>)}
        </div>
      )}
    </div>
  );
}
