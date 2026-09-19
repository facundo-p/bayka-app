import type { ReactNode } from 'react';
import styles from './Aviso.module.css';

/** Recuadro de advertencia dentro del contenido (no bloquea ni se cierra). */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className={styles.aviso} role="status">
      {children}
    </p>
  );
}
