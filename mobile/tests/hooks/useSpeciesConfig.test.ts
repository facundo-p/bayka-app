/**
 * Una especie recuperada no aparece en la configuración, pero la plantación la usa: guardar no
 * puede sacarla, ni en el server ni en local.
 */
const mockSaveSpeciesConfig = jest.fn();
const mockSaveSpeciesConfigLocally = jest.fn();

jest.mock('../../src/queries/adminQueries', () => ({
  getAllSpecies: jest.fn(async () => [{ id: 'euc', nombre: 'Eucalyptus', codigo: 'EUC' }]),
  getPlantationSpeciesConfig: jest.fn(async () => [
    { especieId: 'euc', nombre: 'Eucalyptus', codigo: 'EUC', ordenVisual: 0 },
    { especieId: 'kok', nombre: 'Especie desconocida', codigo: 'recuperada:kok', ordenVisual: 1 },
  ]),
  hasTreesForSpecies: jest.fn(async () => false),
}));
jest.mock('../../src/repositories/PlantationRepository', () => ({
  saveSpeciesConfig: (...args: unknown[]) => mockSaveSpeciesConfig(...args),
  saveSpeciesConfigLocally: (...args: unknown[]) => mockSaveSpeciesConfigLocally(...args),
}));
jest.mock('../../src/hooks/useConfirm', () => ({
  useConfirm: () => ({ show: jest.fn(), confirmProps: {} }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSpeciesConfig } from '../../src/hooks/useSpeciesConfig';

const GUARDADAS = [
  { especieId: 'euc', ordenVisual: 0 },
  { especieId: 'kok', ordenVisual: 1 },
];

async function guardar(pendingSync: boolean) {
  const { result } = renderHook(() => useSpeciesConfig('p1', pendingSync));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.items.map((i) => i.especieId)).toEqual(['euc']);
  await act(() => result.current.handleSave());
}

describe('useSpeciesConfig — especie recuperada', () => {
  beforeEach(() => jest.clearAllMocks());

  it('guardar en el server la conserva', async () => {
    await guardar(false);
    expect(mockSaveSpeciesConfig).toHaveBeenCalledWith('p1', GUARDADAS);
  });

  it('guardar en local la conserva', async () => {
    await guardar(true);
    expect(mockSaveSpeciesConfigLocally).toHaveBeenCalledWith('p1', GUARDADAS);
  });
});
