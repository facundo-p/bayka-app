/*
 * Colorea la distribución de especies del dashboard con los colores de la
 * plantación, los MISMOS que usan el mapa y Datos: así una especie tiene un único
 * color en toda la plantación.
 */
import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import type { ColorEspecie } from '../../theme/coloresEspecie';

export type EspecieColoreada = DistribucionEspecie & { color: string };

export function asignarColoresEspecies(
  porEspecie: DistribucionEspecie[],
  colorDe: ColorEspecie,
): EspecieColoreada[] {
  return porEspecie.map((especie) => ({ ...especie, color: colorDe(especie.codigo) }));
}
