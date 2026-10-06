/*
 * Colores del informe: únicos dentro del documento, por orden de cantidad. No
 * usa `colorEspeciePorCodigo` porque su hash repite colores entre especies, y
 * en el mapa del informe dos especies del mismo color no se distinguen.
 */
import { esSinIdentificar } from '../../queries/especiesConstantes';
import {
  COLOR_GRAFICO_NN,
  COLOR_GRAFICO_OTRAS,
  COLORES_GRAFICOS,
  COLORES_GRAFICOS_EXTRA,
} from '../../theme/chartColors';

/** Los 8 de los gráficos y los 4 extra; con más de 12 especies se cicla. */
export const PALETA_INFORME = [...COLORES_GRAFICOS, ...COLORES_GRAFICOS_EXTRA] as const;

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
    colores.set(codigo, PALETA_INFORME[indice % PALETA_INFORME.length]);
    indice += 1;
  }
  return (codigo) =>
    esSinIdentificar(codigo) ? COLOR_GRAFICO_NN : (colores.get(codigo) ?? COLOR_GRAFICO_OTRAS);
}
