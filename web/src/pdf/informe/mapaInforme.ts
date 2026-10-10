import type { PuntoGps } from '../../queries/mapaQueries';
import { capaSatelital } from '../mapa/capaSatelital';
import { dibujarMapa, FORMATO_MAPA } from '../mapa/dibujarMapa';
import { MAPA_NO_DISPONIBLE, MAPA_SIN_GPS, mapaDeDibujo, type MapaPdf } from '../mapa/estadoMapa';
import { planificarMapa, type EtiquetaMapa, type PuntoMapa } from '../mapa/planMapa';
import type { Pixel } from '../mapa/proyeccion';
import { TOPE_TILES } from '../mapa/tiles';
import { medianaAlVecino } from '../mapa/vecinos';
import { CAJA_MAPA_INFORME, MEDIDA_INFORME } from '../plantilla/tokens';

type Acumulado = { lat: number; lng: number; cantidad: number };

/** El código de cada parcela en el centro de sus puntos; las parcelas sin puntos no llevan. */
export function etiquetasDeParcelas(
  puntos: readonly PuntoGps[],
  parcelas: readonly { id: string; codigo: string }[],
): EtiquetaMapa[] {
  const sumas = new Map<string, Acumulado>();
  for (const { parcelaId, lat, lng } of puntos) {
    if (!parcelaId) continue;
    const suma = sumas.get(parcelaId) ?? { lat: 0, lng: 0, cantidad: 0 };
    sumas.set(parcelaId, { lat: suma.lat + lat, lng: suma.lng + lng, cantidad: suma.cantidad + 1 });
  }
  return parcelas.flatMap(({ id, codigo }) => {
    const suma = sumas.get(id);
    if (!suma) return [];
    return [{ lat: suma.lat / suma.cantidad, lng: suma.lng / suma.cantidad, texto: codigo }];
  });
}

export type Caja = { ancho: number; alto: number };

/**
 * Pocos puntos en un mapa grande se pierden con el radio de miles, y muchos
 * juntos se pisan: el radio sigue a la separación entre vecinos, en pt.
 */
export function radioDePuntos(pixeles: readonly Pixel[]): number {
  const { minimo, maximo } = MEDIDA_INFORME.radioPuntoMapa;
  const separacion = medianaAlVecino(pixeles);
  if (separacion === null) return maximo;
  return Math.min(maximo, Math.max(minimo, MEDIDA_INFORME.factorRadioPunto * separacion));
}

export type MapaInformePdf = { mapa: MapaPdf; caja: Caja };

/**
 * Siempre en la caja 16:9 del informe, con los puntos encuadrados adentro.
 * Si el canvas falla, el informe sale igual con «Mapa no disponible».
 */
export async function dibujarMapaInforme(contenido: {
  puntos: PuntoMapa[];
  etiquetas: EtiquetaMapa[];
}): Promise<MapaInformePdf> {
  const caja: Caja = CAJA_MAPA_INFORME;
  if (contenido.puntos.length === 0) return { mapa: MAPA_SIN_GPS, caja };
  try {
    const opciones = { ...contenido, ...caja, margen: MEDIDA_INFORME.margenMapa };
    const ubicados = planificarMapa(opciones)?.puntos ?? [];
    const dibujado = await dibujarMapa({
      ...opciones,
      radioPunto: radioDePuntos(ubicados),
      fondo: capaSatelital(TOPE_TILES.informe),
      // Con ~7800 puntos, JPEG pesa la mitad que PNG y no se nota la diferencia impreso.
      formato: FORMATO_MAPA.jpeg,
    });
    return { mapa: mapaDeDibujo(dibujado), caja };
  } catch {
    return { mapa: MAPA_NO_DISPONIBLE, caja };
  }
}
