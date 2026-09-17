import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './Topbar.module.css';

interface TopbarProps {
  left?: ReactNode;
  right?: ReactNode;
  /** `compacta`: barra baja (~60px) cuando además lleva las tabs y las acciones. */
  densidad?: 'normal' | 'compacta';
}

/** Barra superior sticky reutilizable. Cada pantalla pasa su contenido:
 *  breadcrumb/rótulo a la izquierda y acciones a la derecha. */
export function Topbar({ left, right, densidad = 'normal' }: TopbarProps) {
  return (
    <header className={cx(styles.topbar, densidad === 'compacta' && styles.compacta)}>
      <div className={styles.left}>{left}</div>
      {right && <div className={styles.right}>{right}</div>}
    </header>
  );
}
