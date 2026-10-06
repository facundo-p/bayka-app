import type { PuntoGps } from '../../queries/mapaQueries';
import { dibujarMapa, FORMATO_MAPA } from '../mapa/dibujarMapa';
import { ESTADO_MAPA, MAPA_NO_DISPONIBLE, MAPA_SIN_GPS, type MapaPdf } from '../mapa/estadoMapa';
import { ENCUADRE_MAPA, type EtiquetaMapa, type PuntoMapa } from '../mapa/planMapa';
import { aspectoDe } from '../mapa/proyeccion';
import { MEDIDA_INFORME } from '../plantilla/tokens';

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
 * El rectángulo más grande dentro de `disponible` con el aspecto de los puntos:
 * así el mapa no deja franjas vacías a los costados de la plantación.
 */
export function cajaDelMapa(puntos: readonly PuntoMapa[], disponible: Caja): Caja {
  const margen = MEDIDA_INFORME.margenMapa * 2;
  const aspecto = aspectoDe(puntos, ENCUADRE_MAPA.minimoMetros);
  const util = { ancho: disponible.ancho - margen, alto: disponible.alto - margen };
  if (util.ancho / util.alto > aspecto) {
    return { ancho: util.alto * aspecto + margen, alto: disponible.alto };
  }
  return { ancho: disponible.ancho, alto: util.ancho / aspecto + margen };
}

/**
 * Pocos puntos en un mapa grande se pierden con el radio de miles: el radio
 * sigue a la distancia media entre puntos, entre un mínimo y un máximo.
 */
export function radioDePuntos(cantidad: number, caja: Caja): number {
  const { minimo, maximo } = MEDIDA_INFORME.radioPuntoMapa;
  const util =
    (caja.ancho - MEDIDA_INFORME.margenMapa * 2) * (caja.alto - MEDIDA_INFORME.margenMapa * 2);
  const radio = MEDIDA_INFORME.factorRadioPunto * Math.sqrt(util / Math.max(1, cantidad));
  return Math.min(maximo, Math.max(minimo, radio));
}

export type MapaInformePdf = { mapa: MapaPdf; caja: Caja };

/** Si el canvas falla, el informe sale igual con «Mapa no disponible». */
export async function dibujarMapaInforme(
  contenido: { puntos: PuntoMapa[]; etiquetas: EtiquetaMapa[] },
  disponible: Caja,
): Promise<MapaInformePdf> {
  const caja = cajaDelMapa(contenido.puntos, disponible);
  if (contenido.puntos.length === 0) return { mapa: MAPA_SIN_GPS, caja };
  try {
    const src = await dibujarMapa({
      ...contenido,
      ...caja,
      margen: MEDIDA_INFORME.margenMapa,
      radioPunto: radioDePuntos(contenido.puntos.length, caja),
      // Con ~7800 puntos, JPEG pesa la mitad que PNG y no se nota la diferencia impreso.
      formato: FORMATO_MAPA.jpeg,
    });
    return { mapa: src ? { estado: ESTADO_MAPA.listo, src } : MAPA_NO_DISPONIBLE, caja };
  } catch {
    return { mapa: MAPA_NO_DISPONIBLE, caja };
  }
}
