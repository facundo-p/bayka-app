import { DECIMALES_GPS } from '../../lib/formato';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';

export { etiquetaEspecie, nombreTecnicoDe, SIN_DATO } from '../../lib/formato';

export type ArbolConGps = ArbolDetalle & { latitude: number; longitude: number };

/** Sin las dos coordenadas no hay punto: nunca se muestra "0,0". */
export function tieneGps(arbol: ArbolDetalle): arbol is ArbolConGps {
  return arbol.latitude != null && arbol.longitude != null;
}

/** La entrada de la parcela del árbol; null sin parcela o si no está entre las cargadas. */
export function parcelaDe<T>(arbol: ArbolDetalle, parcelas: ReadonlyMap<string, T>): T | null {
  return (arbol.parcelaId && parcelas.get(arbol.parcelaId)) || null;
}

/** null si el árbol no tiene parcela o la parcela no está entre las cargadas. */
export function codigoParcelaDe(arbol: ArbolDetalle, codigos: Map<string, string>): string | null {
  return parcelaDe(arbol, codigos);
}

/** «-27.360120, -55.897440»; por defecto con los mismos decimales que la ficha PDF. */
export function textoCoordenadas(arbol: ArbolConGps, decimales: number = DECIMALES_GPS): string {
  return `${arbol.latitude.toFixed(decimales)}, ${arbol.longitude.toFixed(decimales)}`;
}

/** «± 4 m»; null si el celular no informó la precisión. */
export function textoPrecisionGps(arbol: ArbolConGps): string | null {
  return arbol.gpsAccuracy == null ? null : `± ${Math.round(arbol.gpsAccuracy)} m`;
}

const URL_BUSQUEDA_GOOGLE_MAPS = 'https://www.google.com/maps/search/?api=1&query=';

/** El punto en Google Maps, con la URL pública que no pide API key. */
export function urlGoogleMaps(arbol: ArbolConGps): string {
  return `${URL_BUSQUEDA_GOOGLE_MAPS}${arbol.latitude},${arbol.longitude}`;
}
