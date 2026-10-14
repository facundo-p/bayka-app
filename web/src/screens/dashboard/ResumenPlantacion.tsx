import { AlertTriangle } from 'lucide-react';
import { BarraProgreso, type RellenoBarra } from '../../components/BarraProgreso';
import { PuntoColor } from '../../components/PuntoColor';
import { cx } from '../../lib/classNames';
import { concordar, formatearEntero, pluralizar, porcentajeDeObjetivo } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import type { KpisArboles } from '../../queries/dashboardQueries';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './ResumenPlantacion.module.css';

export const TIPO_ALCANCE = { parcela: 'parcela', especie: 'especie' } as const;

/** Parcela o especie elegida; la especie trae su color. */
export interface SeleccionAlcance {
  /** Un código de parcela puede coincidir con uno de especie. */
  tipo: (typeof TIPO_ALCANCE)[keyof typeof TIPO_ALCANCE];
  codigo: string;
  nombre: string;
  color?: string;
}

/** Lo que acota la métrica, con la salida para volver a la plantación entera. */
export interface AlcanceMetrica {
  selecciones: SeleccionAlcance[];
  onVerTodos: () => void;
}

interface ResumenPlantacionProps {
  datos: KpisArboles;
  /** Meta de árboles de la temporada; null si la plantación no la definió. */
  objetivo: number | null;
  /** Sin esto la card mide toda la plantación y no muestra la fila de alcance. */
  alcance?: AlcanceMetrica;
}

/** El verbo concuerda con los N/N de la cifra de al lado. */
const AVISO_PENDIENTES = { singular: 'requiere atención', plural: 'requieren atención' };

/** Sin meta no hay "de 0 · 0%": se avisa que falta. */
function textoMeta(objetivo: number | null, avance: number | null): string {
  if (avance === null || objetivo === null) return 'Meta no definida';
  return `de ${formatearEntero(objetivo)} · Meta de la temporada`;
}

function ChipAlcance({ codigo, nombre, color }: SeleccionAlcance) {
  return (
    <span className={styles.chip}>
      {color && <PuntoColor color={color} conAro />}
      <span className={styles.chipCodigo}>{codigo}</span>
      <span className={styles.chipNombre}>{nombre}</span>
    </span>
  );
}

function FilaAlcance({ selecciones, onVerTodos }: AlcanceMetrica) {
  return (
    <div className={styles.alcance}>
      {selecciones.map((seleccion) => (
        <ChipAlcance key={`${seleccion.tipo}-${seleccion.codigo}`} {...seleccion} />
      ))}
      <button type="button" className={styles.verTodos} onClick={onVerTodos}>
        Ver todos
      </button>
    </div>
  );
}

function Encabezado({ alcance }: { alcance?: AlcanceMetrica }) {
  return (
    <div className={styles.filaEncabezado}>
      <span className={styles.overline}>Árboles registrados</span>
      {alcance && <FilaAlcance {...alcance} />}
    </div>
  );
}

/** Total contra la meta, con la barra de avance solo si hay meta. */
function AvanceMeta({ total, objetivo }: { total: number; objetivo: number | null }) {
  const avance = porcentajeDeObjetivo(total, objetivo);
  return (
    <>
      <div className={styles.filaValor}>
        <span className={styles.valor}>{formatearEntero(total)}</span>
        <span className={styles.meta}>{textoMeta(objetivo, avance)}</span>
      </div>
      {avance !== null && (
        <BarraProgreso alto="lg" fondo="sobrePrimario" relleno="degradado" porcentaje={avance} />
      )}
    </>
  );
}

interface CeldaTasaProps {
  etiqueta: string;
  porcentaje: number;
  /** Cantidad absoluta detrás del porcentaje, ya concordada (ej. "1.234 puntos"). */
  conteo: string;
  relleno: RellenoBarra;
}

/** Celda de tasa: overline + porcentaje, el conteo debajo y la barra al pie. */
function CeldaTasa({ etiqueta, porcentaje, conteo, relleno }: CeldaTasaProps) {
  return (
    <div className={styles.celda}>
      <div className={styles.celdaFila}>
        <span className={styles.overline}>{etiqueta}</span>
        <span className={styles.celdaValor}>{`${porcentaje}%`}</span>
      </div>
      <span className={styles.conteo}>{conteo}</span>
      <BarraProgreso alto="sm" fondo="sobrePrimario" relleno={relleno} porcentaje={porcentaje} />
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
          {concordar(cantidad, AVISO_PENDIENTES)}
        </span>
      )}
    </div>
  );
}

function CeldasTasas({ datos }: { datos: KpisArboles }) {
  return (
    <div className={styles.celdas}>
      <CeldaTasa
        etiqueta="Con GPS"
        porcentaje={datos.porcentajeConGps}
        conteo={pluralizar(datos.arbolesConGps, SUSTANTIVO.punto)}
        relleno="secundario"
      />
      <CeldaTasa
        etiqueta="Con foto"
        porcentaje={datos.porcentajeConFoto}
        conteo={pluralizar(datos.arbolesConFoto, SUSTANTIVO.foto)}
        relleno="primarioSuave"
      />
      <CeldaSinIdentificar cantidad={datos.arbolesNN} />
    </div>
  );
}

/** Card azul del dashboard: total de árboles contra la meta, y las tres tasas. */
export function ResumenPlantacion({ datos, objetivo, alcance }: ResumenPlantacionProps) {
  return (
    <section className={styles.card} aria-label="Resumen de la plantación">
      <div className={styles.blob} aria-hidden />
      <div className={styles.bloqueSuperior}>
        <Encabezado alcance={alcance} />
        <AvanceMeta total={datos.totalArboles} objetivo={objetivo} />
      </div>
      <CeldasTasas datos={datos} />
    </section>
  );
}
