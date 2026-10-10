import { waitFor } from '@testing-library/react';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { renderHookConQuery } from '../../test/renderHookConQuery';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { useColoresEspecie } from '../useColoresEspecie';

vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));

const especie = (codigo: string, lugarColor: number) => ({
  id: codigo,
  codigo,
  nombre: codigo,
  nombreCientifico: null,
  lugarColor,
});

beforeEach(() => vi.clearAllMocks());

describe('useColoresEspecie', () => {
  test('mientras se leen las especies no está listo', () => {
    vi.mocked(listarEspeciesDePlantacion).mockReturnValue(new Promise(() => {}));
    const { result } = renderHookConQuery(() => useColoresEspecie('plant-1'));
    expect(result.current.listo).toBe(false);
  });

  test('con las especies habilitadas, el color sale del lugar de cada una', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([
      especie('TIM', 2),
      especie('ANC', 1),
      especie('AAA', 0),
    ]);
    const { result } = renderHookConQuery(() => useColoresEspecie('plant-1'));
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(listarEspeciesDePlantacion).toHaveBeenCalledWith('plant-1');
    expect(result.current.colorDe('ANC')).toBe('#99b95b');
    expect(result.current.colorDe('TIM')).toBe('#3b7db5');
  });

  test('si la lectura falla, queda listo y pinta cada código por su hash', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('rls'));
    const { result } = renderHookConQuery(() => useColoresEspecie('plant-1'));
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(result.current.colorDe('ANC')).toBe(colorEspeciePorCodigo('ANC'));
    expect(result.current.colorDe('TIM')).toBe(colorEspeciePorCodigo('TIM'));
  });

  test('fuera de una plantación no consulta y está listo con el respaldo', () => {
    const { result } = renderHookConQuery(() => useColoresEspecie(''));
    expect(result.current.listo).toBe(true);
    expect(listarEspeciesDePlantacion).not.toHaveBeenCalled();
    expect(result.current.colorDe('ANC')).toBe(colorEspeciePorCodigo('ANC'));
  });
});
