/**
 * FACHADA agnóstica de proveedor del mapa de puntos GPS.
 *
 * Para cambiar de herramienta de mapas (p.ej. a MapLibre/Mapbox) se crea una
 * implementación nueva (`MapaPuntos<Proveedor>.tsx`) que respete
 * `MapaPuntosProps` y se cambia SOLO la línea de re-export de abajo. Ningún
 * caller ni la fachada conocen el proveedor concreto.
 */
export { MapaPuntosLeaflet as MapaPuntos } from './MapaPuntosLeaflet';
export type { MapaPuntosProps, VarianteMapa, PuntoGps } from './types';
