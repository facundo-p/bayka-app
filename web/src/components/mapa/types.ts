import type { PuntoGps } from '../../queries/mapaQueries';

/** Contrato agnóstico del mapa: re-exportamos PuntoGps para que los callers y
 *  las implementaciones (Leaflet u otra) dependan de este módulo, no del
 *  proveedor concreto. */
export type { PuntoGps };

/** Variante de tamaño: `panel` llena la card del dashboard; `compacto` es el
 *  cuadrado del detalle de árbol, con un solo punto más grande. Las medidas
 *  viven en `MapaPuntos.module.css`. */
export type VarianteMapa = 'panel' | 'compacto';

export const VARIANTE_MAPA_POR_DEFECTO: VarianteMapa = 'panel';

export interface MapaPuntosProps {
  puntos: PuntoGps[];
  colorPorCodigo: Map<string, string>;
  variante?: VarianteMapa;
}
