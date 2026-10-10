import { QueryClient } from '@tanstack/react-query';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { leerColoresEspecie } from '../coloresDePlantacion';

vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));

const especie = (codigo: string) => ({
  id: codigo,
  codigo,
  nombre: codigo,
  nombreCientifico: null,
});
const nuevoCliente = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => vi.clearAllMocks());

describe('leerColoresEspecie (descargas: KML)', () => {
  test('usa el catálogo de la plantación aunque los puntos traigan menos especies', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue(['AAA', 'TIM'].map(especie));
    const colorDe = await leerColoresEspecie(nuevoCliente(), 'plant-1', ['TIM']);
    expect(colorDe('TIM')).toBe('#99b95b');
  });

  test('sin especies legibles, los colores salen de los códigos de los puntos', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('red'));
    const colorDe = await leerColoresEspecie(nuevoCliente(), 'plant-1', ['TIM', 'ANC', 'TIM']);
    expect(colorDe('ANC')).toBe('#0a3760');
    expect(colorDe('TIM')).toBe('#99b95b');
  });
});
