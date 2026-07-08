import { describe, expect, test } from 'vitest';
import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import { COLOR_GRAFICO_NN } from '../../theme/chartColors';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { asignarColoresEspecies, mapaColorPorCodigo } from '../dashboard/coloresEspecies';

const NN: DistribucionEspecie = { codigo: 'NN', nombre: 'Sin identificar', cantidad: 10 };
const QB: DistribucionEspecie = { codigo: 'QB', nombre: 'Quebracho', cantidad: 30 };
const AL: DistribucionEspecie = { codigo: 'AL', nombre: 'Algarrobo', cantidad: 20 };

describe('asignarColoresEspecies', () => {
  test('cada especie toma su color estable por código', () => {
    const coloreadas = asignarColoresEspecies([QB, AL]);
    expect(coloreadas[0].color).toBe(colorEspeciePorCodigo('QB'));
    expect(coloreadas[1].color).toBe(colorEspeciePorCodigo('AL'));
  });

  test('N/N siempre es ámbar', () => {
    const [coloreada] = asignarColoresEspecies([NN]);
    expect(coloreada.color).toBe(COLOR_GRAFICO_NN);
  });

  test('el color de una especie no depende del orden ni de la presencia de N/N', () => {
    const conNN = asignarColoresEspecies([QB, NN, AL]);
    const otroOrden = asignarColoresEspecies([AL, QB]);
    expect(conNN.find((especie) => especie.codigo === 'QB')?.color).toBe(colorEspeciePorCodigo('QB'));
    expect(conNN.find((especie) => especie.codigo === 'AL')?.color).toBe(colorEspeciePorCodigo('AL'));
    expect(otroOrden.find((especie) => especie.codigo === 'QB')?.color).toBe(colorEspeciePorCodigo('QB'));
    expect(otroOrden.find((especie) => especie.codigo === 'AL')?.color).toBe(colorEspeciePorCodigo('AL'));
  });
});

describe('mapaColorPorCodigo', () => {
  test('indexa codigo → color estable por código', () => {
    const mapa = mapaColorPorCodigo(asignarColoresEspecies([QB, NN, AL]));
    expect(mapa.get('QB')).toBe(colorEspeciePorCodigo('QB'));
    expect(mapa.get('NN')).toBe(COLOR_GRAFICO_NN);
    expect(mapa.get('AL')).toBe(colorEspeciePorCodigo('AL'));
    expect([...mapa.keys()]).toEqual(['QB', 'NN', 'AL']);
  });
});
