import { QueryClient } from '@tanstack/react-query';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { especieEnLugar as especie } from '../../test/fabricas';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { leerColoresEspecie } from '../coloresDePlantacion';

vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));

const nuevoCliente = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => vi.clearAllMocks());

describe('leerColoresEspecie (descargas: KML, informe)', () => {
  test('cada especie toma el color de su lugar en la plantación', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([especie('AAA', 1), especie('TIM', 0)]);
    const colorDe = await leerColoresEspecie(nuevoCliente(), 'plant-1');
    expect(colorDe('TIM')).toBe('#0a3760');
    expect(colorDe('AAA')).toBe('#99b95b');
  });

  test('sin especies legibles, cada código se pinta por su hash', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('red'));
    const colorDe = await leerColoresEspecie(nuevoCliente(), 'plant-1');
    expect(colorDe('ANC')).toBe(colorEspeciePorCodigo('ANC'));
    expect(colorDe('TIM')).toBe(colorEspeciePorCodigo('TIM'));
  });
});
