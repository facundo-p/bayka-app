import type { ArbolParaFicha } from '../../queries/fichasQueries';
import type { PuntoGps } from '../../queries/mapaQueries';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { capaSatelital } from '../mapa/capaSatelital';
import { dibujarMapa } from '../mapa/dibujarMapa';
import { MAPA_NO_DISPONIBLE, MAPA_SIN_GPS, mapaDeDibujo, type MapaPdf } from '../mapa/estadoMapa';
import type { ContenidoMapa } from '../mapa/planMapa';
import { distanciaMetros, type LatLng } from '../../../../shared/distancia';
import { TOPE_TILES } from '../mapa/tiles';
import { MEDIDA_FICHA } from '../plantilla/tokens';

/**
 * Un vecino más lejos que esto es un GPS errado (0,0 o un dígito de más): si
 * entrara al encuadre, achicaría la parcela a un punto.
 */
export const RADIO_VECINOS_M = 2000;

function vecinosDe(arbol: ArbolParaFicha, centro: LatLng, puntos: readonly PuntoGps[]) {
  const { parcelaId } = arbol;
  // Sin parcela no hay vecinos: «sin parcela» juntaría árboles de toda la plantación.
  if (!parcelaId) return [];
  return puntos.filter(
    (punto) =>
      punto.parcelaId === parcelaId &&
      punto.idArbol !== arbol.idArbol &&
      distanciaMetros(centro, punto) <= RADIO_VECINOS_M,
  );
}

/** Toda la parcela del árbol, con el árbol resaltado; null si el árbol no tiene GPS. */
export function contenidoMinimapa(
  arbol: ArbolParaFicha,
  puntos: readonly PuntoGps[],
): ContenidoMapa | null {
  if (!arbol.gps) return null;
  const { lat, lng } = arbol.gps;
  return {
    puntos: vecinosDe(arbol, { lat, lng }, puntos).map((vecino) => ({
      lat: vecino.lat,
      lng: vecino.lng,
      color: colorEspeciePorCodigo(vecino.codigo),
    })),
    resaltado: { lat, lng, color: colorEspeciePorCodigo(arbol.especie?.codigo ?? null) },
    ancho: MEDIDA_FICHA.ladoMapa,
    alto: MEDIDA_FICHA.ladoMapa,
  };
}

/** Si el canvas falla, la ficha de ese árbol dice «Mapa no disponible» y el resto sigue. */
export async function minimapaDeArbol(
  arbol: ArbolParaFicha,
  puntos: readonly PuntoGps[],
): Promise<MapaPdf> {
  const contenido = contenidoMinimapa(arbol, puntos);
  if (!contenido) return MAPA_SIN_GPS;
  try {
    return mapaDeDibujo(
      await dibujarMapa({ ...contenido, fondo: capaSatelital(TOPE_TILES.ficha) }),
    );
  } catch {
    return MAPA_NO_DISPONIBLE;
  }
}
