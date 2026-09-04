import { varsCss } from '../lib/cssVars';
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
  // Sin objetivo definido: ocultamos progreso/cifras (evita "· 0 · 0%") y avisamos que falta la meta.
  const tieneObjetivo = objetivo > 0;
  return (
    <div className={styles.card}>
      <div className={styles.blob} aria-hidden />
      <span className={styles.overline}>{overline}</span>
      <p className={styles.value}>{formatearEntero(valor)}</p>
      {tieneObjetivo && (
        <div className={styles.track}>
          <div className={styles.fill} style={varsCss({ ancho: `${porcentaje}%` })} />
        </div>
      )}
      <p className={styles.footer}>
        {tieneObjetivo ? `${metaLabel} · ${formatearEntero(objetivo)} · ${porcentaje}%` : 'Meta no definida'}
      </p>
    </div>
  );
}
