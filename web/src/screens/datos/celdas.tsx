import { Check } from 'lucide-react';
import { varsCss } from '../../lib/cssVars';
import { NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { tieneFotoSubida } from '../../services/fotoService';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { TAMANO_ICONO } from '../../theme/iconos';
import styles from './SeccionesDatos.module.css';

/* Celdas con formato propio de las tablas de la tab Datos. */

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

/** Coordenadas + precisión; nada si el árbol no tiene GPS (nunca "0,0"). */
export function CeldaGps({ arbol }: { arbol: ArbolDetalle }) {
  if (arbol.latitude == null || arbol.longitude == null) return '—';
  return (
    <span className={styles.gps}>
      {arbol.latitude.toFixed(DECIMALES_GPS)}, {arbol.longitude.toFixed(DECIMALES_GPS)}
      {arbol.gpsAccuracy != null && (
        <span className={styles.precision}> ±{Math.round(arbol.gpsAccuracy)}m</span>
      )}
    </span>
  );
}

/** Especie del árbol (ver `BloqueEspecie` en ArbolDetallePanel). */
export function CeldaEspecie({ arbol }: { arbol: ArbolDetalle }) {
  const codigo = arbol.especieCodigo ?? 'N/N';
  const nombre = arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR;
  return (
    <span className={styles.especie}>
      <span
        className={styles.puntoEspecie}
        style={varsCss({ color: colorEspeciePorCodigo(arbol.especieCodigo) })}
      />
      {`${codigo} · ${nombre}`}
    </span>
  );
}

/** Check no interactivo cuando el árbol tiene foto subida; nada si no hay.
 *  La foto se ve abriendo el detalle de la fila. */
export function CeldaFoto({ fotoUrl }: { fotoUrl: string | null }) {
  if (!tieneFotoSubida(fotoUrl)) return null;
  return (
    <span className={styles.fotoCheck} aria-label="Con foto">
      <Check size={TAMANO_ICONO.md} />
    </span>
  );
}
