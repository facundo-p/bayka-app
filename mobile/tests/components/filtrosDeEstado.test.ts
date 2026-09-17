import { filtrosDeEstado } from '../../src/components/filtrosDeEstado';

jest.mock('../../src/theme', () => ({
  colors: { stateActiva: '#activa', stateFinalizada: '#finalizada' },
}));

describe('filtrosDeEstado', () => {
  test('arma un filtro por estado con su conteo, en orden activa → finalizada', () => {
    const filtros = filtrosDeEstado({ activa: 3, finalizada: 1 });
    expect(filtros.map((f) => [f.key, f.label, f.count, f.color])).toEqual([
      ['activa', 'Activas', 3, '#activa'],
      ['finalizada', 'Finalizadas', 1, '#finalizada'],
    ]);
  });
});
