jest.mock('../../src/database/liveQuery', () => ({
  useLiveData: jest.fn(),
  notifyDataChanged: jest.fn(),
}));
jest.mock('../../src/queries/adminQueries', () => ({ getPlantationEstadoDeEdicion: jest.fn() }));

const { useLiveData } = require('../../src/database/liveQuery');

import { renderHook } from '@testing-library/react-native';
import { usePlantacionEditable } from '../../src/hooks/usePlantacionEditable';

function conEstado(data: unknown) {
  (useLiveData as jest.Mock).mockReturnValue({ data });
}

describe('usePlantacionEditable', () => {
  test('sin cargar: no editable, para no habilitar nada antes de saber el estado', () => {
    conEstado(undefined);
    const { result } = renderHook(() => usePlantacionEditable('p1'));
    expect(result.current.estadoLoaded).toBe(false);
    expect(result.current.plantacionEditable).toBe(false);
  });

  test('activa sin archivar: editable', () => {
    conEstado([{ estado: 'activa', archivadaEn: null }]);
    const { result } = renderHook(() => usePlantacionEditable('p1'));
    expect(result.current).toMatchObject({
      estadoLoaded: true, plantacionEditable: true, isFinalizada: false, isArchivada: false,
    });
  });

  test('finalizada: no editable', () => {
    conEstado([{ estado: 'finalizada', archivadaEn: null }]);
    const { result } = renderHook(() => usePlantacionEditable('p1'));
    expect(result.current).toMatchObject({ plantacionEditable: false, isFinalizada: true, isArchivada: false });
  });

  test('archivada: no editable', () => {
    conEstado([{ estado: 'activa', archivadaEn: '2026-09-17T12:00:00+00:00' }]);
    const { result } = renderHook(() => usePlantacionEditable('p1'));
    expect(result.current).toMatchObject({ plantacionEditable: false, isArchivada: true });
  });
});
