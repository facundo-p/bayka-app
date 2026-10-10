/*
 * Colores del informe: únicos dentro del documento, por orden de cantidad, con
 * la misma paleta de especies que la web. El orden es el del informe y no el
 * del catálogo, así que una especie puede llevar otro color que en la web.
 */
import { esSinIdentificar } from '../../queries/especiesConstantes';
import { COLOR_GRAFICO_NN, COLOR_GRAFICO_OTRAS } from '../../theme/chartColors';
import { PALETA_ESPECIES } from '../../theme/coloresEspecie';

/** Color de cada código de especie. */
export type ColoresInforme = (codigo: string) => string;

/**
 * `especies` llega ordenada por cantidad, de mayor a menor. N/N siempre va en
 * ámbar y no consume un color de la paleta. Un código que no está en la lista
 * va en gris.
 */
export function asignarColoresInforme(especies: readonly { codigo: string }[]): ColoresInforme {
  const colores = new Map<string, string>();
  let indice = 0;
  for (const { codigo } of especies) {
    if (esSinIdentificar(codigo)) continue;
    colores.set(codigo, PALETA_ESPECIES[indice % PALETA_ESPECIES.length]);
    indice += 1;
  }
  return (codigo) =>
    esSinIdentificar(codigo) ? COLOR_GRAFICO_NN : (colores.get(codigo) ?? COLOR_GRAFICO_OTRAS);
}
