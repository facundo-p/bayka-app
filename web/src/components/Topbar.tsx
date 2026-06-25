import type { ReactNode } from 'react';
import styles from './Topbar.module.css';

interface TopbarProps {
  left?: ReactNode;
  right?: ReactNode;
}

/** Barra superior sticky reutilizable. Cada pantalla pasa su contenido:
 *  breadcrumb/rótulo a la izquierda y acciones a la derecha. */
export function Topbar({ left, right }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>{left}</div>
      {right && <div className={styles.right}>{right}</div>}
    </header>
  );
}
