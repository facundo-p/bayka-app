import { Check } from 'lucide-react';
import { PuntoColor } from '../../components';
import { tieneFotoSubida } from '../../services/fotoService';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { TAMANO_ICONO } from '../../theme/iconos';
import {
  etiquetaEspecie,
  SIN_DATO,
  textoCoordenadas,
  textoPrecisionGps,
  tieneGps,
} from './arbolFormato';
import styles from './SeccionesDatos.module.css';

export function CeldaDescripcion({ descripcion }: { descripcion: string | null }) {
  if (!descripcion) return <>{SIN_DATO}</>;
  return (
    <span className={styles.descripcion} title={descripcion}>
      {descripcion}
    </span>
  );
}

/** En la tabla alcanza con ~1 m: la columna queda más angosta que en el detalle. */
const DECIMALES_GPS_TABLA = 5;

/** Lat/lng redondeadas y, si se conoce, la precisión en metros. */
export function CeldaGps({ arbol }: { arbol: ArbolDetalle }) {
  if (!tieneGps(arbol)) return SIN_DATO;
  const precision = textoPrecisionGps(arbol);
  return (
    <span className={styles.gps}>
      {textoCoordenadas(arbol, DECIMALES_GPS_TABLA)}
      {precision && <span className={styles.precision}> {precision}</span>}
    </span>
  );
}

interface EspecieConPuntoProps {
  arbol: ArbolDetalle;
  className: string;
}

/** Punto de color de la especie seguido de "código · nombre". */
export function EspecieConPunto({ arbol, className }: EspecieConPuntoProps) {
  return (
    <span className={className}>
      <PuntoColor
        color={colorEspeciePorCodigo(arbol.especieCodigo)}
        className={styles.puntoEspecie}
      />
      {etiquetaEspecie(arbol)}
    </span>
  );
}

export function CeldaEspecie({ arbol }: { arbol: ArbolDetalle }) {
  return <EspecieConPunto arbol={arbol} className={styles.especie} />;
}

/** La foto se ve abriendo el detalle de la fila. */
export function CeldaFoto({ fotoUrl }: { fotoUrl: string | null }) {
  if (!tieneFotoSubida(fotoUrl)) return null;
  return (
    <span className={styles.fotoCheck} aria-label="Con foto">
      <Check size={TAMANO_ICONO.md} />
    </span>
  );
}
