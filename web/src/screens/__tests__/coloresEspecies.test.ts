import type { DistribucionEspecie } from '../../queries/dashboardQueries';
import { COLOR_GRAFICO_NN, colorEspeciePorIndice } from '../../theme/chartColors';
import { asignarColoresEspecies, mapaColorPorCodigo } from '../dashboard/coloresEspecies';

const NN: DistribucionEspecie = { codigo: 'NN', nombre: 'Sin identificar', cantidad: 10 };
const QB: DistribucionEspecie = { codigo: 'QB', nombre: 'Quebracho', cantidad: 30 };
const AL: DistribucionEspecie = { codigo: 'AL', nombre: 'Algarrobo', cantidad: 20 };

describe('asignarColoresEspecies', () => {
  test('la primera especie identificada toma el primer color de la paleta', () => {
    const coloreadas = asignarColoresEspecies([QB, AL]);
    expect(coloreadas[0].color).toBe(colorEspeciePorIndice(0));
    expect(coloreadas[1].color).toBe(colorEspeciePorIndice(1));
  });

  test('N/N siempre es ámbar', () => {
    const [coloreada] = asignarColoresEspecies([NN]);
    expect(coloreada.color).toBe(COLOR_GRAFICO_NN);
  });

  test('N/N no desplaza el índice de paleta de las demás', () => {
    const coloreadas = asignarColoresEspecies([QB, NN, AL]);
    expect(coloreadas[0].color).toBe(colorEspeciePorIndice(0)); // QB
    expect(coloreadas[1].color).toBe(COLOR_GRAFICO_NN); // NN
    expect(coloreadas[2].color).toBe(colorEspeciePorIndice(1)); // AL conserva índice 1
  });
});

describe('mapaColorPorCodigo', () => {
  test('indexa codigo → color preservando el orden de inserción', () => {
    const mapa = mapaColorPorCodigo(asignarColoresEspecies([QB, NN, AL]));
    expect(mapa.get('QB')).toBe(colorEspeciePorIndice(0));
    expect(mapa.get('NN')).toBe(COLOR_GRAFICO_NN);
    expect(mapa.get('AL')).toBe(colorEspeciePorIndice(1));
    expect([...mapa.keys()]).toEqual(['QB', 'NN', 'AL']);
  });
});
