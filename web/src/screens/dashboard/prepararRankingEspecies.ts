import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import {
  ESPECIE_SIN_IDENTIFICAR,
  NOMBRE_SIN_IDENTIFICAR,
} from '../../queries/especiesConstantes';
import {
  COLOR_GRAFICO_NN,
  COLOR_GRAFICO_OTRAS,
  COLORES_GRAFICOS,
} from '../../theme/chartColors';

/** Fracción del total bajo la cual una especie se agrupa en "Otras". */
const UMBRAL_OTRAS = 0.03;

/** Nombre visible del segmento que agrupa las especies minoritarias. */
export const NOMBRE_OTRAS = 'Otras';

export type BarraEspecie = { nombre: string; cantidad: number; color: string };

function sumarCantidades(distribucion: DistribucionEspecie[]): number {
  return distribucion.reduce((suma, especie) => suma + especie.cantidad, 0);
}

function esSinIdentificar(especie: DistribucionEspecie): boolean {
  return especie.codigo === ESPECIE_SIN_IDENTIFICAR;
}

/** Un color de marca por especie, ciclando la paleta si hay más de diez. */
function barrasPrincipales(principales: DistribucionEspecie[]): BarraEspecie[] {
  return principales.map((especie, indice) => ({
    nombre: especie.nombre,
    cantidad: especie.cantidad,
    color: COLORES_GRAFICOS[indice % COLORES_GRAFICOS.length],
  }));
}

/**
 * Ranking de árboles por especie para el gráfico de barras horizontales.
 * La distribución llega ordenada descendente; las especies con menos del 3%
 * del total se agrupan en "Otras" (gris de dato) y los árboles sin especie van
 * como "Sin identificar" (amarillo N/N), ambos al final del ranking.
 */
export function prepararRankingEspecies(distribucion: DistribucionEspecie[]): BarraEspecie[] {
  const total = sumarCantidades(distribucion);
  if (total === 0) return [];
  const identificadas = distribucion.filter((especie) => !esSinIdentificar(especie));
  const principales = identificadas.filter((especie) => especie.cantidad / total >= UMBRAL_OTRAS);
  const otras = sumarCantidades(
    identificadas.filter((especie) => especie.cantidad / total < UMBRAL_OTRAS),
  );
  const sinIdentificar = sumarCantidades(distribucion.filter(esSinIdentificar));
  const barras = barrasPrincipales(principales);
  if (otras > 0) barras.push({ nombre: NOMBRE_OTRAS, cantidad: otras, color: COLOR_GRAFICO_OTRAS });
  if (sinIdentificar > 0) {
    barras.push({ nombre: NOMBRE_SIN_IDENTIFICAR, cantidad: sinIdentificar, color: COLOR_GRAFICO_NN });
  }
  return barras;
}
