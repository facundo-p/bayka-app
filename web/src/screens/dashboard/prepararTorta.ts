import { ESPECIE_SIN_IDENTIFICAR } from '../../queries/dataExplorerQueries';
import {
  NOMBRE_SIN_IDENTIFICAR,
  type DistribucionEspecie,
} from '../../queries/dashboardQueries';
import {
  COLOR_GRAFICO_NN,
  COLOR_GRAFICO_OTRAS,
  COLORES_GRAFICOS,
} from '../../theme/chartColors';

/** Fracción del total bajo la cual una especie se agrupa en "Otras". */
const UMBRAL_OTRAS = 0.03;

/** Nombre visible del segmento que agrupa las especies minoritarias. */
export const NOMBRE_OTRAS = 'Otras';

export type SegmentoTorta = { nombre: string; cantidad: number; color: string };

function sumarCantidades(distribucion: DistribucionEspecie[]): number {
  return distribucion.reduce((suma, especie) => suma + especie.cantidad, 0);
}

function esSinIdentificar(especie: DistribucionEspecie): boolean {
  return especie.codigo === ESPECIE_SIN_IDENTIFICAR;
}

/** Un color de marca por especie, ciclando la paleta si hay más de diez. */
function segmentosPrincipales(principales: DistribucionEspecie[]): SegmentoTorta[] {
  return principales.map((especie, indice) => ({
    nombre: especie.nombre,
    cantidad: especie.cantidad,
    color: COLORES_GRAFICOS[indice % COLORES_GRAFICOS.length],
  }));
}

/**
 * Segmentos de la torta por especie: las especies con menos del 3% del total
 * se agrupan en "Otras" (gris) y los árboles sin especie van como
 * "Sin identificar" (amarillo N/N), siempre al final.
 */
export function prepararTorta(distribucion: DistribucionEspecie[]): SegmentoTorta[] {
  const total = sumarCantidades(distribucion);
  if (total === 0) return [];
  const identificadas = distribucion.filter((especie) => !esSinIdentificar(especie));
  const principales = identificadas.filter((especie) => especie.cantidad / total >= UMBRAL_OTRAS);
  const otras = sumarCantidades(
    identificadas.filter((especie) => especie.cantidad / total < UMBRAL_OTRAS),
  );
  const sinIdentificar = sumarCantidades(distribucion.filter(esSinIdentificar));
  const segmentos = segmentosPrincipales(principales);
  if (otras > 0) segmentos.push({ nombre: NOMBRE_OTRAS, cantidad: otras, color: COLOR_GRAFICO_OTRAS });
  if (sinIdentificar > 0) {
    segmentos.push({ nombre: NOMBRE_SIN_IDENTIFICAR, cantidad: sinIdentificar, color: COLOR_GRAFICO_NN });
  }
  return segmentos;
}
