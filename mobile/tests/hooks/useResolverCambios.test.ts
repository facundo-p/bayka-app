const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));

const CONFLICTOS = [
  { campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000, editadoPor: null, editadoEn: null, mioEn: null },
  { campo: 'descripcion', mio: 'Mía', web: 'Web', anterior: null, editadoPor: null, editadoEn: null, mioEn: null },
];
jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: () => ({ data: { lugar: 'Lote Norte', conflictos: CONFLICTOS } }),
}));
jest.mock('../../src/repositories/PlantationRepository', () => ({ resolverCambios: jest.fn() }));

import { act, renderHook } from '@testing-library/react-native';
import { useResolverCambios } from '../../src/hooks/useResolverCambios';
import { resolverCambios } from '../../src/repositories/PlantationRepository';

const mockResolver = resolverCambios as jest.Mock;

describe('useResolverCambios', () => {
  beforeEach(() => jest.clearAllMocks());

  it('guarda todas las elecciones juntas (sin tocar, el propio) y vuelve', async () => {
    mockResolver.mockResolvedValue(undefined);
    const { result } = renderHook(() => useResolverCambios('p1'));

    act(() => result.current.elegir('descripcion', 'web'));
    await act(() => result.current.guardar());

    expect(mockResolver).toHaveBeenCalledWith('p1', { objetivoArboles: 'mio', descripcion: 'web' });
    expect(mockBack).toHaveBeenCalled();
  });

  it('si falla no se va de la pantalla y muestra el error', async () => {
    mockResolver.mockRejectedValue(new Error('sqlite'));
    const { result } = renderHook(() => useResolverCambios('p1'));

    await act(() => result.current.guardar());

    expect(result.current.error).toBe('No se pudo guardar la elección. Probá de nuevo.');
    expect(result.current.guardando).toBe(false);
    expect(mockBack).not.toHaveBeenCalled();
  });
});
