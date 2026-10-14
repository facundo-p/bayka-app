/** Tests de useNNResolution: permisos de resolución según el estado de la plantación. */

const mockCambiarEspecie = jest.fn();

jest.mock('../../src/repositories/TreeRepository', () => ({
  cambiarEspecie: (...args: unknown[]) => mockCambiarEspecie(...args),
}));

jest.mock('../../src/hooks/useTrees', () => ({
  useTrees: jest.fn().mockReturnValue({ allTrees: [], totalCount: 0, unresolvedNN: 0 }),
}));

jest.mock('../../src/hooks/usePlantationSpecies', () => ({
  usePlantationSpecies: jest.fn().mockReturnValue({ species: [], loading: false }),
}));

const mockProfile = { rol: 'admin' };
jest.mock('../../src/hooks/useProfileData', () => ({
  useProfileData: () => ({ profile: mockProfile, loading: false }),
}));

jest.mock('../../src/hooks/useCurrentUserId', () => ({
  useCurrentUserId: () => 'user-1',
}));

jest.mock('../../src/queries/plantationDetailQueries', () => ({
  getNNTreesForPlantation: jest.fn(),
}));

const mockPlantationNNTrees: {
  id: string;
  posicion: number;
  subId: string;
  fotoUrl: string | null;
  especieId: string | null;
  grupoId: string;
  grupoCodigo?: string;
  grupoCreador?: string;
}[] = [];

const mockEstadoDeEdicion: { estado: string; archivadaEn: string | null } = { estado: 'activa', archivadaEn: null };

jest.mock('../../src/queries/adminQueries', () => ({
  getPlantationEstadoDeEdicion: jest.fn(),
}));

jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn().mockImplementation((queryFn: () => unknown) => (
    String(queryFn).includes('getPlantationEstadoDeEdicion')
      ? { data: mockEstadoDeEdicion }
      : { data: mockPlantationNNTrees }
  )),
  notifyDataChanged: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { useNNResolution } from '../../src/hooks/useNNResolution';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlantationNNTrees.length = 0;
  mockEstadoDeEdicion.estado = 'activa';
  mockEstadoDeEdicion.archivadaEn = null;
  mockProfile.rol = 'admin';
});

describe('useNNResolution — plantación no editable', () => {
  const nn = { id: 'tree-1', posicion: 1, subId: 'L1NN1', fotoUrl: null, especieId: null, grupoId: 'sg-1', grupoCodigo: 'L1' };

  test('plantación activa → puede resolver', () => {
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.canResolve).toBe(true);
  });

  test('plantación archivada → no puede resolver ni guardar (#477)', async () => {
    mockEstadoDeEdicion.archivadaEn = '2026-09-17T12:00:00+00:00';
    mockPlantationNNTrees.push(nn);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    act(() => result.current.handleSelectSpecies('esp-1'));
    await act(async () => { await result.current.handleGuardar(jest.fn()); });

    expect(result.current.canResolve).toBe(false);
    expect(mockCambiarEspecie).not.toHaveBeenCalled();
  });

  test('plantación finalizada → no puede resolver', () => {
    mockEstadoDeEdicion.estado = 'finalizada';
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.canResolve).toBe(false);
  });
});

// #768: el server rechaza a un técnico que escribe en un grupo ajeno.
describe('useNNResolution — grupos ajenos en modo plantación', () => {
  const propio = { id: 'tree-1', posicion: 1, subId: 'L1NN1', fotoUrl: null, especieId: null, grupoId: 'sg-1', grupoCreador: 'user-1' };
  const ajeno = { id: 'tree-2', posicion: 1, subId: 'L2NN1', fotoUrl: null, especieId: null, grupoId: 'sg-2', grupoCreador: 'otro' };

  test('un técnico resuelve los N/N de sus grupos', () => {
    mockProfile.rol = 'tecnico';
    mockPlantationNNTrees.push(propio, ajeno);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.canResolve).toBe(true);
    act(() => result.current.setCurrentIndex(1));
    expect(result.current.canResolve).toBe(false);
  });

  test('un técnico no guarda la especie de un N/N ajeno', async () => {
    mockProfile.rol = 'tecnico';
    mockPlantationNNTrees.push(propio, ajeno);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    act(() => result.current.handleSelectSpecies('esp-1'));
    act(() => result.current.setCurrentIndex(1));
    act(() => result.current.handleSelectSpecies('esp-2'));
    await act(async () => { await result.current.handleGuardar(jest.fn()); });

    expect(mockCambiarEspecie).toHaveBeenCalledTimes(1);
    expect(mockCambiarEspecie).toHaveBeenCalledWith('tree-1', 'esp-1');
  });

  test('un admin resuelve también los ajenos', () => {
    mockPlantationNNTrees.push(ajeno);
    const { result } = renderHook(() => useNNResolution({ plantacionId: 'plant-1' }));

    expect(result.current.canResolve).toBe(true);
  });
});
