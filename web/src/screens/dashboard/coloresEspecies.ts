/*
 * Colorea la distribución de especies del dashboard reutilizando el mapeo
 * canónico código→color (`colorEspeciePorCodigo`), el MISMO que usan el mapa y
 * el listado de Datos: así una especie tiene un único color en toda la app.
 */
import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';

export type EspecieColoreada = DistribucionEspecie & { color: string };

/** Colorea la distribución: cada especie toma su color estable por código
 *  (N/N → ámbar). */
export function asignarColoresEspecies(porEspecie: DistribucionEspecie[]): EspecieColoreada[] {
  return porEspecie.map((especie) => ({
    ...especie,
    color: colorEspeciePorCodigo(especie.codigo),
  }));
}

/** Mapa codigo → color para resolver el color de un punto/especie por código. */
export function mapaColorPorCodigo(coloreadas: EspecieColoreada[]): Map<string, string> {
  return new Map(coloreadas.map((especie) => [especie.codigo, especie.color]));
}
