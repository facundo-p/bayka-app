/*
 * Asignación de color por especie compartida entre el mapa (leyenda + puntos) y
 * el panel "Por especie", para que ambos pinten la misma especie igual.
 *
 * Regla de color: las especies identificadas toman color por su índice de
 * paleta (`colorEspeciePorIndice`); las N/N siempre el ámbar (`COLOR_GRAFICO_NN`)
 * y NO consumen índice de paleta, así las identificadas conservan su color
 * estable sin importar dónde caiga el segmento "Sin identificar".
 */
import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import { ESPECIE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { COLOR_GRAFICO_NN, colorEspeciePorIndice } from '../../theme/chartColors';

export type EspecieColoreada = DistribucionEspecie & { color: string };

function esSinIdentificar(especie: DistribucionEspecie): boolean {
  return especie.codigo === ESPECIE_SIN_IDENTIFICAR;
}

/** Colorea la distribución (ya ordenada desc): paleta por índice a las
 *  identificadas, ámbar fijo a las N/N sin gastar índice de paleta. */
export function asignarColoresEspecies(porEspecie: DistribucionEspecie[]): EspecieColoreada[] {
  let indicePaleta = 0;
  return porEspecie.map((especie) => ({
    ...especie,
    color: esSinIdentificar(especie)
      ? COLOR_GRAFICO_NN
      : colorEspeciePorIndice(indicePaleta++),
  }));
}

/** Mapa codigo → color para resolver el color de un punto/especie por código. */
export function mapaColorPorCodigo(coloreadas: EspecieColoreada[]): Map<string, string> {
  return new Map(coloreadas.map((especie) => [especie.codigo, especie.color]));
}
