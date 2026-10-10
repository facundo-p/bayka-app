/*
 * Colorea la distribución de especies del dashboard con los colores de la
 * plantación, los MISMOS que usan el mapa y Datos: así una especie tiene un único
 * color en toda la plantación.
 */
import type { DistribucionEspecie, FuenteDashboard } from '../../queries/dashboardQueries';
import type { ColorEspecie } from '../../theme/coloresEspecie';

export type EspecieColoreada = DistribucionEspecie & { color: string };

/** Códigos de las especies con árboles en la plantación entera, sin el filtro de parcela. */
export function codigosConArboles(fuente: FuenteDashboard | undefined): string[] {
  if (!fuente) return [];
  const usadas = new Set(fuente.arboles.map((conteo) => conteo.speciesId));
  return fuente.especies.filter((especie) => usadas.has(especie.id)).map(({ codigo }) => codigo);
}

export function asignarColoresEspecies(
  porEspecie: DistribucionEspecie[],
  colorDe: ColorEspecie,
): EspecieColoreada[] {
  return porEspecie.map((especie) => ({ ...especie, color: colorDe(especie.codigo) }));
}
