import type { ReactNode } from 'react';
import styles from './ArbolDetallePanel.module.css';

interface BloqueDetalleProps {
  titulo: string;
  /** Acción chica a la derecha del rótulo, ej. un enlace. */
  accion?: ReactNode;
  children: ReactNode;
}

/** Bloque del detalle del árbol: rótulo legible arriba, contenido debajo. */
export function BloqueDetalle({ titulo, accion, children }: BloqueDetalleProps) {
  return (
    <div className={styles.bloque}>
      <div className={styles.rotuloFila}>
        <span className={styles.rotulo}>{titulo}</span>
        {accion}
      </div>
      {children}
    </div>
  );
}
