import type { ArbolParaFicha } from '../../queries/fichasQueries';
import type { PuntoGps } from '../../queries/mapaQueries';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import type { ContenidoMapa } from '../mapa/planMapa';
import { MEDIDA_FICHA } from '../plantilla/tokens';

/** Toda la parcela del árbol, con el árbol resaltado; null si el árbol no tiene GPS. */
export function contenidoMinimapa(
  arbol: ArbolParaFicha,
  puntos: readonly PuntoGps[],
): ContenidoMapa | null {
  if (!arbol.gps) return null;
  const { lat, lng } = arbol.gps;
  const vecinos = puntos.filter(
    (punto) => punto.parcelaId === arbol.parcelaId && punto.idArbol !== arbol.idArbol,
  );
  return {
    puntos: vecinos.map((vecino) => ({
      lat: vecino.lat,
      lng: vecino.lng,
      color: colorEspeciePorCodigo(vecino.codigo),
    })),
    resaltado: { lat, lng, color: colorEspeciePorCodigo(arbol.especie?.codigo ?? null) },
    ancho: MEDIDA_FICHA.ladoMapa,
    alto: MEDIDA_FICHA.ladoMapa,
  };
}
