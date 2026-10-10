import { waitFor } from '@testing-library/react';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { renderHookConQuery } from '../../test/renderHookConQuery';
import { useColoresEspecie } from '../useColoresEspecie';

vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));

const especie = (codigo: string) => ({
  id: codigo,
  codigo,
  nombre: codigo,
  nombreCientifico: null,
});
const PRESENTES = ['TIM', 'ANC'];

beforeEach(() => vi.clearAllMocks());

describe('useColoresEspecie', () => {
  test('mientras se leen las especies no está listo', () => {
    vi.mocked(listarEspeciesDePlantacion).mockReturnValue(new Promise(() => {}));
    const { result } = renderHookConQuery(() => useColoresEspecie('plant-1', PRESENTES));
    expect(result.current.listo).toBe(false);
  });

  test('con las especies habilitadas, el color sale del catálogo de la plantación', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue(['TIM', 'ANC', 'AAA'].map(especie));
    const { result } = renderHookConQuery(() => useColoresEspecie('plant-1', PRESENTES));
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(listarEspeciesDePlantacion).toHaveBeenCalledWith('plant-1');
    expect(result.current.colorDe('ANC')).toBe('#99b95b');
    expect(result.current.colorDe('TIM')).toBe('#3b7db5');
  });

  test('si la lectura falla, queda listo y usa los códigos presentes', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('rls'));
    const { result } = renderHookConQuery(() => useColoresEspecie('plant-1', PRESENTES));
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(result.current.colorDe('ANC')).toBe('#0a3760');
    expect(result.current.colorDe('TIM')).toBe('#99b95b');
  });

  test('sin especies habilitadas usa los códigos presentes', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([]);
    const { result } = renderHookConQuery(() => useColoresEspecie('plant-1', PRESENTES));
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(result.current.colorDe('ANC')).not.toBe(result.current.colorDe('TIM'));
  });

  test('fuera de una plantación no consulta y está listo con los presentes', () => {
    const { result } = renderHookConQuery(() => useColoresEspecie('', PRESENTES));
    expect(result.current.listo).toBe(true);
    expect(listarEspeciesDePlantacion).not.toHaveBeenCalled();
    expect(result.current.colorDe('ANC')).toBe('#0a3760');
  });
});
