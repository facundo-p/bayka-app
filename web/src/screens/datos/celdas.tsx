import { Check } from 'lucide-react';
import { PuntoColor } from '../../components';
import { tieneFotoSubida } from '../../services/fotoService';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { TAMANO_ICONO } from '../../theme/iconos';
import { etiquetaEspecie, tieneGps, type ArbolConGps } from './arbolFormato';
import styles from './SeccionesDatos.module.css';

export function CeldaDescripcion({ descripcion }: { descripcion: string | null }) {
  if (!descripcion) return <>—</>;
  return (
    <span className={styles.descripcion} title={descripcion}>
      {descripcion}
    </span>
  );
}

/** Redondeo de coordenadas para mostrar (~1 m de precisión). */
const DECIMALES_GPS = 5;

/** Lat/lng redondeadas y, si se conoce, la precisión en metros. */
export function Coordenadas({ arbol, className }: { arbol: ArbolConGps; className: string }) {
  return (
    <span className={className}>
      {arbol.latitude.toFixed(DECIMALES_GPS)}, {arbol.longitude.toFixed(DECIMALES_GPS)}
      {arbol.gpsAccuracy != null && (
        <span className={styles.precision}> ±{Math.round(arbol.gpsAccuracy)}m</span>
      )}
    </span>
  );
}

export function CeldaGps({ arbol }: { arbol: ArbolDetalle }) {
  if (!tieneGps(arbol)) return '—';
  return <Coordenadas arbol={arbol} className={styles.gps} />;
}

interface EspecieConPuntoProps {
  arbol: ArbolDetalle;
  tamano?: 'md' | 'lg';
  className: string;
}

/** Punto de color de la especie seguido de "código · nombre". */
export function EspecieConPunto({ arbol, tamano, className }: EspecieConPuntoProps) {
  return (
    <span className={className}>
      <PuntoColor
        color={colorEspeciePorCodigo(arbol.especieCodigo)}
        tamano={tamano}
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
