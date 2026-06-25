import { formatearEntero } from '../lib/formato';
import styles from './HeroMetric.module.css';

interface HeroMetricProps {
  overline: string;
  valor: number;
  objetivo: number;
  porcentaje: number;
  metaLabel?: string;
}

/** Card hero azul del dashboard (Árboles registrados). */
export function HeroMetric({
  overline,
  valor,
  objetivo,
  porcentaje,
  metaLabel = 'Meta de la temporada',
}: HeroMetricProps) {
  return (
    <div className={styles.card}>
      <div className={styles.blob} aria-hidden />
      <span className={styles.overline}>{overline}</span>
      <p className={styles.value}>{formatearEntero(valor)}</p>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${porcentaje}%` }} />
      </div>
      <p className={styles.footer}>
        {metaLabel} · {formatearEntero(objetivo)} · {porcentaje}%
      </p>
    </div>
  );
}
