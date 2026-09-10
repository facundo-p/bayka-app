import type { PuntoGps } from '../../queries/mapaQueries';

/** Contrato agnóstico del mapa: re-exportamos PuntoGps para que los callers y
 *  las implementaciones (Leaflet u otra) dependan de este módulo, no del
 *  proveedor concreto. */
export type { PuntoGps };

/** Variante de tamaño: `panel` llena la card del dashboard; `compacto` es el
 *  alto fijo del detalle de árbol. Las medidas viven en `MapaPuntos.module.css`. */
export type VarianteMapa = 'panel' | 'compacto';

export interface MapaPuntosProps {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
  variante?: VarianteMapa;
}
