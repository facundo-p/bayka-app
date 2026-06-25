import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './Badge.module.css';

/* Estados de dominio en español (activa/finalizada/pendiente) + genéricos. */
type BadgeVariant = 'activa' | 'finalizada' | 'pendiente' | 'warning' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  /** Punto de color a la izquierda (pills de estado del rediseño). */
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ variant = 'neutral', dot = false, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[variant])}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}
