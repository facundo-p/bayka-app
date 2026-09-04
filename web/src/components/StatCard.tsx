import { AlertTriangle } from 'lucide-react';
import { cx } from '../lib/classNames';
import { varsCss } from '../lib/cssVars';
import styles from './StatCard.module.css';

/** Barra de progreso opcional; el color es dato (token CSS pasado por el caller). */
interface StatCardBar {
  pct: number;
  color: string;
}

interface StatCardProps {
  label: string;
  value: string;
  variant?: 'default' | 'warn';
  bar?: StatCardBar;
  hint?: string;
}

/** Card de KPI del dashboard (Con GPS / Con foto / N/N sin resolver). */
export function StatCard({ label, value, variant = 'default', bar, hint }: StatCardProps) {
  const esWarn = variant === 'warn';
  return (
    <div className={cx(styles.card, esWarn && styles.warn)}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
      </div>
      {bar && (
        <div className={styles.track}>
          <div className={styles.fill} style={varsCss({ ancho: `${bar.pct}%`, color: bar.color })} />
        </div>
      )}
      {hint && (
        <p className={styles.hint}>
          {esWarn && <AlertTriangle className={styles.hintIcon} size={14} aria-hidden />}
          {hint}
        </p>
      )}
    </div>
  );
}
