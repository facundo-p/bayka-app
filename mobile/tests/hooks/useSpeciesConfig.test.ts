/**
 * Guardar manda solo lo que cambió (#635): una especie que no se muestra (recuperada)
 * no se toca, y una con árboles en el teléfono no se puede quitar.
 */
const mockGuardar = jest.fn();
const mockShow = jest.fn();
const mockHasTrees = jest.fn(async (_p: string, especieId: string) => especieId === 'pin');

jest.mock('../../src/queries/adminQueries', () => ({
  getAllSpecies: jest.fn(async () => [
    { id: 'pin', nombre: 'Pino', codigo: 'PIN' },
    { id: 'euc', nombre: 'Eucalyptus', codigo: 'EUC' },
    { id: 'ace', nombre: 'Acacia', codigo: 'ACE' },
  ]),
  getPlantationSpeciesConfig: jest.fn(async () => [
    { especieId: 'euc', nombre: 'Eucalyptus', codigo: 'EUC' },
    { especieId: 'pin', nombre: 'Pino', codigo: 'PIN' },
    { especieId: 'kok', nombre: 'Especie desconocida', codigo: 'recuperada:kok' },
  ]),
  hasTreesForSpecies: (p: string, e: string) => mockHasTrees(p, e),
}));
jest.mock('../../src/services/EspeciesDePlantacionService', () => ({
  guardarEspeciesDePlantacion: (...args: unknown[]) => mockGuardar(...args),
}));
jest.mock('../../src/hooks/useConfirm', () => ({
  useConfirm: () => ({ show: mockShow, confirmProps: {} }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSpeciesConfig } from '../../src/hooks/useSpeciesConfig';

async function montar(pendingSync = false) {
  const hook = renderHook(() => useSpeciesConfig('p1', pendingSync));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useSpeciesConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuardar.mockResolvedValue([]);
  });

  it('lista el catálogo por nombre, sin las recuperadas', async () => {
    const { result } = await montar();
    expect(result.current.items.map((i) => i.especieId)).toEqual(['ace', 'euc', 'pin']);
  });

  it('guardar sin tocar nada no manda cambios', async () => {
    const { result } = await montar();
    await act(() => result.current.handleSave());
    expect(mockGuardar).toHaveBeenCalledWith('p1', { altas: [], bajas: [] }, false);
  });

  it('manda altas y bajas, con pendingSync', async () => {
    const { result } = await montar(true);
    act(() => result.current.handleToggle('ace', true));
    act(() => result.current.handleToggle('euc', false));
    await act(() => result.current.handleSave());
    expect(mockGuardar).toHaveBeenCalledWith('p1', { altas: ['ace'], bajas: ['euc'] }, true);
  });

  it('una especie con árboles en el teléfono no se destilda, ni con "deseleccionar todas"', async () => {
    const { result } = await montar();
    act(() => result.current.handleToggle('pin', false));
    expect(result.current.items.find((i) => i.especieId === 'pin')?.enabled).toBe(true);
    act(() => result.current.handleSelectAll());
    act(() => result.current.handleSelectAll());
    expect(result.current.items.filter((i) => i.enabled).map((i) => i.especieId)).toEqual(['pin']);
  });

  it('guardado sin rechazos cierra', async () => {
    const onClose = jest.fn();
    const { result } = await montar();
    await act(() => result.current.handleSave(onClose));
    expect(onClose).toHaveBeenCalled();
  });

  it('una baja que el server mantuvo por árboles avisa y deja la pantalla abierta', async () => {
    mockGuardar.mockResolvedValue([{ especieId: 'euc', nombre: 'Eucalyptus' }]);
    const onClose = jest.fn();
    const { result } = await montar();
    act(() => result.current.handleToggle('euc', false));
    await act(() => result.current.handleSave(onClose));
    expect(onClose).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Eucalyptus ya tiene árboles registrados en el servidor, así que sigue habilitada.',
    }));
    // Recarga desde SQLite, donde la especie volvió a estar habilitada, y queda con candado
    // aunque el teléfono no tenga sus árboles.
    const euc = result.current.items.find((i) => i.especieId === 'euc');
    expect(euc).toMatchObject({ enabled: true, hasExistingTrees: true });
    act(() => result.current.handleToggle('euc', false));
    expect(result.current.items.find((i) => i.especieId === 'euc')?.enabled).toBe(true);
  });

  it('un rechazo de la plantación muestra el motivo', async () => {
    mockGuardar.mockRejectedValue(new Error('La plantación está archivada y no acepta cambios. Los cambios no se guardaron.'));
    const onClose = jest.fn();
    const { result } = await montar();
    await act(() => result.current.handleSave(onClose));
    expect(onClose).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({
      message: 'La plantación está archivada y no acepta cambios. Los cambios no se guardaron.',
    }));
  });
});
