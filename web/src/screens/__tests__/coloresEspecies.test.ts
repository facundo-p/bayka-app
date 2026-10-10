import { describe, expect, test } from 'vitest';
import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import { COLOR_GRAFICO_NN } from '../../theme/chartColors';
import { coloresDeEspecies } from '../../theme/coloresEspecie';
import { asignarColoresEspecies } from '../dashboard/coloresEspecies';

const NN: DistribucionEspecie = { codigo: 'NN', nombre: 'Sin identificar', cantidad: 10 };
const QB: DistribucionEspecie = { codigo: 'QB', nombre: 'Quebracho', cantidad: 30 };
const AL: DistribucionEspecie = { codigo: 'AL', nombre: 'Algarrobo', cantidad: 20 };

const colorDe = coloresDeEspecies(['QB', 'AL']);

function colorDeCodigo(coloreadas: { codigo: string; color: string }[], codigo: string) {
  return coloreadas.find((especie) => especie.codigo === codigo)?.color;
}

describe('asignarColoresEspecies', () => {
  test('cada especie toma el color que tiene en la plantación', () => {
    const coloreadas = asignarColoresEspecies([QB, AL], colorDe);
    expect(coloreadas[0].color).toBe(colorDe('QB'));
    expect(coloreadas[1].color).toBe(colorDe('AL'));
    expect(coloreadas[0].color).not.toBe(coloreadas[1].color);
  });

  test('N/N siempre es ámbar', () => {
    const [coloreada] = asignarColoresEspecies([NN], colorDe);
    expect(coloreada.color).toBe(COLOR_GRAFICO_NN);
  });

  test('el color de una especie no depende del orden ni de la presencia de N/N', () => {
    const conNN = asignarColoresEspecies([QB, NN, AL], colorDe);
    const otroOrden = asignarColoresEspecies([AL, QB], colorDe);
    expect(colorDeCodigo(conNN, 'QB')).toBe(colorDeCodigo(otroOrden, 'QB'));
    expect(colorDeCodigo(conNN, 'AL')).toBe(colorDeCodigo(otroOrden, 'AL'));
  });
});
