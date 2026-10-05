/**
 * FACHADA agnóstica de proveedor del mapa de puntos GPS.
 *
 * Para cambiar de herramienta de mapas (p.ej. a MapLibre/Mapbox) se crea una
 * implementación nueva (`MapaPuntos<Proveedor>.tsx`) que respete
 * `MapaPuntosProps` y se cambia SOLO el import de abajo. Ningún caller ni la
 * fachada conocen el proveedor concreto.
 */
import { lazy, Suspense } from 'react';
import { cx } from '../../lib/classNames';
import { VARIANTE_MAPA_POR_DEFECTO, type MapaPuntosProps } from './types';
import styles from './MapaPuntos.module.css';

// El proveedor baja en su propio chunk recién cuando se muestra un mapa (#684).
const MapaPuntosProveedor = lazy(() =>
  import('./MapaPuntosLeaflet').then((modulo) => ({ default: modulo.MapaPuntosLeaflet })),
);

export function MapaPuntos(props: MapaPuntosProps) {
  // Sin puntos no hay mapa: no vale la pena bajar el proveedor.
  if (props.puntos.length === 0) return null;
  // Mientras baja, ocupa el mismo lugar que el mapa para que la card no salte.
  const reserva = (
    <div className={cx(styles.contenedor, styles[props.variante ?? VARIANTE_MAPA_POR_DEFECTO])} />
  );
  return (
    <Suspense fallback={reserva}>
      <MapaPuntosProveedor {...props} />
    </Suspense>
  );
}

export type { MapaPuntosProps, VarianteMapa, PuntoGps } from './types';
