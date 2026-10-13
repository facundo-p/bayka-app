import { capaSatelital } from '../mapa/capaSatelital';
import { dibujarMapa, FORMATO_MAPA } from '../mapa/dibujarMapa';
import { MAPA_NO_DISPONIBLE, MAPA_SIN_GPS, mapaDeDibujo, type MapaPdf } from '../mapa/estadoMapa';
import { planificarMapa, type PuntoMapa } from '../mapa/planMapa';
import type { Pixel } from '../mapa/proyeccion';
import { TOPE_TILES } from '../mapa/tiles';
import { radioSegunVecinos } from '../mapa/vecinos';
import { CAJA_MAPA_INFORME, MEDIDA_INFORME } from '../plantilla/tokens';

/** Radio de los puntos del mapa del informe, en pt. */
export function radioDePuntos(pixeles: readonly Pixel[]): number {
  return radioSegunVecinos(pixeles, MEDIDA_INFORME.radioPuntoMapa);
}

export type MapaInformePdf = { mapa: MapaPdf };

/**
 * Siempre en la caja 16:9 del informe, con los puntos encuadrados adentro.
 * Si el canvas falla, el informe sale igual con «Mapa no disponible».
 */
export async function dibujarMapaInforme(contenido: {
  puntos: PuntoMapa[];
}): Promise<MapaInformePdf> {
  if (contenido.puntos.length === 0) return { mapa: MAPA_SIN_GPS };
  try {
    const opciones = { ...contenido, ...CAJA_MAPA_INFORME, margen: MEDIDA_INFORME.margenMapa };
    const ubicados = planificarMapa(opciones)?.puntos ?? [];
    const dibujado = await dibujarMapa({
      ...opciones,
      radioPunto: radioDePuntos(ubicados),
      fondo: capaSatelital(TOPE_TILES.informe),
      // Con ~7800 puntos, JPEG pesa la mitad que PNG y no se nota la diferencia impreso.
      formato: FORMATO_MAPA.jpeg,
    });
    return { mapa: mapaDeDibujo(dibujado) };
  } catch {
    return { mapa: MAPA_NO_DISPONIBLE };
  }
}
