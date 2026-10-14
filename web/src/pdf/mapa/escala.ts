import { metrosPorPixel, type Encuadre } from './proyeccion';

/** Una distancia redonda es 1, 2 o 5 por una potencia de 10. */
const PASOS_REDONDOS = [5, 2, 1] as const;
const METROS_POR_KM = 1000;
const UNIDAD = { metros: 'm', kilometros: 'km' } as const;

/** La distancia redonda más larga que no pasa de `maximoMetros`. */
export function distanciaRedonda(maximoMetros: number): number {
  const potencia = 10 ** Math.floor(Math.log10(maximoMetros));
  const paso = PASOS_REDONDOS.find((candidato) => candidato * potencia <= maximoMetros) ?? 1;
  return paso * potencia;
}

/** «50 m», «1 km», «2,5 km». */
export function textoDistancia(metros: number): string {
  if (metros < METROS_POR_KM) return `${metros} ${UNIDAD.metros}`;
  const km = (metros / METROS_POR_KM).toLocaleString('es-AR');
  return `${km} ${UNIDAD.kilometros}`;
}

export type BarraEscala = { largo: number; texto: string };

/** Barra de escala que no pasa de `largoMaximo` (en las unidades del encuadre). */
export function barraDeEscala(encuadre: Encuadre, largoMaximo: number): BarraEscala {
  const metrosPorUnidad = metrosPorPixel(encuadre.latitudCentro, encuadre.zoom);
  const metros = distanciaRedonda(largoMaximo * metrosPorUnidad);
  return { largo: metros / metrosPorUnidad, texto: textoDistancia(metros) };
}
