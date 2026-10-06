import type { Pixel } from './proyeccion';

/** Con 400 puntos la mediana ya es estable, y 400 × 8000 distancias tardan poco. */
const MUESTRA_VECINOS = 400;

/** Cada n-ésimo, para que la muestra sea la misma en cada render. */
function muestra<T>(items: readonly T[], tope: number): T[] {
  const paso = Math.max(1, Math.ceil(items.length / tope));
  return items.filter((_, indice) => indice % paso === 0);
}

/** Un punto repetido en el mismo lugar no cuenta como vecino. */
function distanciaAlMasCercano(punto: Pixel, todos: readonly Pixel[]): number {
  let minima = Infinity;
  for (const otro of todos) {
    const distancia = Math.hypot(otro.x - punto.x, otro.y - punto.y);
    if (distancia > 0 && distancia < minima) minima = distancia;
  }
  return minima;
}

function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
}

/**
 * Mediana de la distancia de cada punto a su vecino más cercano: mide lo juntos
 * que están los árboles sin contar el espacio vacío entre parcelas. null con
 * menos de dos posiciones distintas.
 */
export function medianaAlVecino(pixeles: readonly Pixel[], tope = MUESTRA_VECINOS): number | null {
  const distancias = muestra(pixeles, tope)
    .map((punto) => distanciaAlMasCercano(punto, pixeles))
    .filter(Number.isFinite);
  return distancias.length === 0 ? null : mediana(distancias);
}
