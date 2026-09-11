import { AlertTriangle } from 'lucide-react';
import { cx } from '../../lib/classNames';
import { varsCss } from '../../lib/cssVars';
import { formatearEntero, porcentajeDeObjetivo } from '../../lib/formato';
import type { KpisArboles } from '../../queries/dashboardQueries';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './ResumenPlantacion.module.css';

/** Parcela que acota la métrica, con la salida para volver a la plantación entera. */
export interface AlcanceMetrica {
  codigo: string;
  nombre: string;
  onVerTodos: () => void;
}

interface ResumenPlantacionProps {
  datos: KpisArboles;
  /** Meta de árboles de la temporada; null si la plantación no la definió. */
  objetivo: number | null;
  /** Sin esto la card mide toda la plantación y no muestra la fila de alcance. */
  alcance?: AlcanceMetrica;
}

/** Sin meta no hay "de 0 · 0%": se avisa que falta. */
function textoMeta(objetivo: number | null, avance: number | null): string {
  if (avance === null || objetivo === null) return 'Meta no definida';
  return `de ${formatearEntero(objetivo)} · Meta de la temporada`;
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

/** Celda de tasa: overline + porcentaje + barra al pie. */
function CeldaTasa({
  etiqueta,
  porcentaje,
  claseBarra,
}: {
  etiqueta: string;
  porcentaje: number;
  claseBarra: string;
}) {
  return (
    <div className={styles.celda}>
      <div className={styles.celdaFila}>
        <span className={styles.overline}>{etiqueta}</span>
        <span className={styles.celdaValor}>{`${porcentaje}%`}</span>
      </div>
      <div className={styles.barra}>
        <div
          className={cx(styles.relleno, claseBarra)}
          style={varsCss({ ancho: `${porcentaje}%` })}
        />
      </div>
    </div>
  );
}

/** Celda N/N: en cero es un dato más; con pendientes se pinta en ámbar y avisa. */
function CeldaSinIdentificar({ cantidad }: { cantidad: number }) {
  const hayPendientes = cantidad > 0;
  return (
    <div className={styles.celda}>
      <div className={styles.celdaFila}>
        <span className={styles.overline}>N/N</span>
        <span className={cx(styles.celdaValor, hayPendientes && styles.valorAlerta)}>
          {formatearEntero(cantidad)}
        </span>
      </div>
      {hayPendientes && (
        <span className={styles.hint}>
          <AlertTriangle size={TAMANO_ICONO.sm} aria-hidden />
          requieren atención
        </span>
      )}
    </div>
  );
}

/** Card azul del dashboard: total de árboles contra la meta, y las tres tasas. */
export function ResumenPlantacion({ datos, objetivo, alcance }: ResumenPlantacionProps) {
  const avance = porcentajeDeObjetivo(datos.totalArboles, objetivo);
  return (
    <section className={styles.card} aria-label="Resumen de la plantación">
      <div className={styles.blob} aria-hidden />
      <div className={styles.bloqueSuperior}>
        <div className={styles.filaEncabezado}>
          <span className={styles.overline}>Árboles registrados</span>
          {alcance && <FilaAlcance {...alcance} />}
        </div>
        <div className={styles.filaValor}>
          <span className={styles.valor}>{formatearEntero(datos.totalArboles)}</span>
          <span className={styles.meta}>{textoMeta(objetivo, avance)}</span>
        </div>
        {avance !== null && (
          <div className={styles.track}>
            <div className={styles.fill} style={varsCss({ ancho: `${avance}%` })} />
          </div>
        )}
      </div>
      <div className={styles.celdas}>
        <CeldaTasa
          etiqueta="Con GPS"
          porcentaje={datos.porcentajeConGps}
          claseBarra={styles.rellenoGps}
        />
        <CeldaTasa
          etiqueta="Con foto"
          porcentaje={datos.porcentajeConFoto}
          claseBarra={styles.rellenoFoto}
        />
        <CeldaSinIdentificar cantidad={datos.arbolesNN} />
      </div>
    </section>
  );
}
