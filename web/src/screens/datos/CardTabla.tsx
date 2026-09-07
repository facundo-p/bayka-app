import type { ReactNode } from 'react';
import styles from './SeccionesDatos.module.css';

interface CardTablaProps {
  /** Texto del pie: recuento del rango visible + qué hace clickear una fila. */
  pie?: string;
  /** Controles del pie a la derecha (paginación); sin esto el pie es solo texto. */
  acciones?: ReactNode;
  children: ReactNode;
}

/** Card de las tres secciones de Datos: la tabla scrollea adentro y el pie
 *  queda fijo al borde inferior, en vez de empujar el documento. */
export function CardTabla({ pie, acciones, children }: CardTablaProps) {
  return (
    <div className={styles.cardTabla}>
      <div className={styles.tablaScroll}>{children}</div>
      {(pie || acciones) && (
        <div className={styles.pieCard}>
          {pie && <span className={styles.pieTexto}>{pie}</span>}
          {acciones}
        </div>
      )}
    </div>
  );
}
