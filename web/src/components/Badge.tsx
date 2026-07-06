import type { ReactNode } from 'react';
import { cx } from '../lib/classNames';
import styles from './Badge.module.css';

/* Estados de dominio en español (activa/finalizada/pendiente) + genéricos. */
type BadgeVariant = 'activa' | 'finalizada' | 'pendiente' | 'warning' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={cx(styles.badge, styles[variant])}>{children}</span>;
}
