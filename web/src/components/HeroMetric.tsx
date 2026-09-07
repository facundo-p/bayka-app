import { varsCss } from '../lib/cssVars';
import { formatearEntero } from '../lib/formato';
import styles from './HeroMetric.module.css';

/** Parcela que acota la métrica, con la salida para volver a la plantación entera. */
export interface AlcanceMetrica {
  codigo: string;
  nombre: string;
  onVerTodos: () => void;
}

interface HeroMetricProps {
  overline: string;
  valor: number;
  objetivo: number;
  porcentaje: number;
  metaLabel?: string;
  /** Sin esto la card mide toda la plantación y no muestra la fila de alcance. */
  alcance?: AlcanceMetrica;
}

function FilaAlcance({ codigo, nombre, onVerTodos }: AlcanceMetrica) {
  return (
    <div className={styles.alcance}>
      <span className={styles.chip}>
        <span className={styles.chipCodigo}>{codigo}</span>
        <span className={styles.chipNombre}>{nombre}</span>
      </span>
      <button type="button" className={styles.verTodos} onClick={onVerTodos}>
        Ver todos
      </button>
    </div>
  );
}

/** Card hero azul del dashboard (Árboles registrados). */
export function HeroMetric({
  overline,
  valor,
  objetivo,
  porcentaje,
  metaLabel = 'Meta de la temporada',
  alcance,
}: HeroMetricProps) {
  // Sin objetivo definido: ocultamos progreso/cifras (evita "· 0 · 0%") y avisamos que falta la meta.
  const tieneObjetivo = objetivo > 0;
  return (
    <div className={styles.card}>
      <div className={styles.blob} aria-hidden />
      <span className={styles.overline}>{overline}</span>
      <p className={styles.value}>{formatearEntero(valor)}</p>
      {alcance && <FilaAlcance {...alcance} />}
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
