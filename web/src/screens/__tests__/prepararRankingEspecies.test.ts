import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import { NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import {
  COLOR_GRAFICO_NN,
  COLOR_GRAFICO_OTRAS,
  COLORES_GRAFICOS,
} from '../../theme/chartColors';
import { NOMBRE_OTRAS, prepararRankingEspecies } from '../dashboard/prepararRankingEspecies';

function especie(nombre: string, cantidad: number): DistribucionEspecie {
  return { codigo: nombre.slice(0, 2).toUpperCase(), nombre, cantidad };
}

/** Entrada de árboles sin especie, como la produce agruparPorEspecie. */
function sinIdentificar(cantidad: number): DistribucionEspecie {
  return { codigo: 'NN', nombre: NOMBRE_SIN_IDENTIFICAR, cantidad };
}

describe('prepararRankingEspecies', () => {
  test('agrupa las especies con menos del 3% en Otras (gris de dato)', () => {
    const distribucion = [
      especie('Quebracho', 60),
      especie('Algarrobo', 31),
      especie('Lapacho', 5),
      especie('Timbó', 2),
      especie('Ceibo', 2),
    ];

    expect(prepararRankingEspecies(distribucion)).toEqual([
      { nombre: 'Quebracho', cantidad: 60, color: COLORES_GRAFICOS[0] },
      { nombre: 'Algarrobo', cantidad: 31, color: COLORES_GRAFICOS[1] },
      { nombre: 'Lapacho', cantidad: 5, color: COLORES_GRAFICOS[2] },
      { nombre: NOMBRE_OTRAS, cantidad: 4, color: COLOR_GRAFICO_OTRAS },
    ]);
  });

  test('los sin especie van como barra amarilla al final, aun bajo el 3%', () => {
    const distribucion = [especie('Quebracho', 99), sinIdentificar(1)];

    expect(prepararRankingEspecies(distribucion)).toEqual([
      { nombre: 'Quebracho', cantidad: 99, color: COLORES_GRAFICOS[0] },
      { nombre: NOMBRE_SIN_IDENTIFICAR, cantidad: 1, color: COLOR_GRAFICO_NN },
    ]);
  });

  test('una sola especie con el 100% queda como única barra', () => {
    expect(prepararRankingEspecies([especie('Quebracho', 40)])).toEqual([
      { nombre: 'Quebracho', cantidad: 40, color: COLORES_GRAFICOS[0] },
    ]);
  });

  test('sin árboles devuelve un ranking vacío', () => {
    expect(prepararRankingEspecies([])).toEqual([]);
  });
});
