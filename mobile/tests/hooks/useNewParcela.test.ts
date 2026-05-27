/**
 * Tests for useNewParcela — validates that the hook forwards calls to
 * ParcelaRepository with the correct arguments and short-circuits when
 * plantacionId is missing.
 */

const mockCreateParcela = jest.fn();
const mockUpdateParcela = jest.fn();
const mockDeleteParcela = jest.fn();

jest.mock('../../src/repositories/ParcelaRepository', () => ({
  createParcela: (params: unknown) => mockCreateParcela(params),
  updateParcela: (id: string, params: unknown) => mockUpdateParcela(id, params),
  deleteParcela: (id: string) => mockDeleteParcela(id),
}));

import { useNewParcela } from '../../src/hooks/useNewParcela';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useNewParcela', () => {
  test('handleCreateParcela sin plantacionId retorna error unknown', async () => {
    const { handleCreateParcela } = useNewParcela(undefined);
    const result = await handleCreateParcela({ nombre: 'A', codigo: 'A' });
    expect(result).toEqual({ success: false, error: 'unknown' });
    expect(mockCreateParcela).not.toHaveBeenCalled();
  });

  test('handleCreateParcela con plantacionId invoca createParcela con descripcion null por defecto', async () => {
    mockCreateParcela.mockResolvedValue({ success: true, id: 'p-1' });
    const { handleCreateParcela } = useNewParcela('plant-1');
    const result = await handleCreateParcela({ nombre: 'Lote A', codigo: 'LA' });
    expect(mockCreateParcela).toHaveBeenCalledWith({
      plantacionId: 'plant-1',
      nombre: 'Lote A',
      codigo: 'LA',
      descripcion: null,
    });
    expect(result).toEqual({ success: true, id: 'p-1' });
  });

  test('handleCreateParcela pasa descripcion cuando se provee', async () => {
    mockCreateParcela.mockResolvedValue({ success: true, id: 'p-2' });
    const { handleCreateParcela } = useNewParcela('plant-1');
    await handleCreateParcela({ nombre: 'B', codigo: 'B', descripcion: 'detalle' });
    expect(mockCreateParcela).toHaveBeenCalledWith({
      plantacionId: 'plant-1',
      nombre: 'B',
      codigo: 'B',
      descripcion: 'detalle',
    });
  });

  test('handleUpdateParcela invoca updateParcela con id + values', async () => {
    mockUpdateParcela.mockResolvedValue({ success: true });
    const { handleUpdateParcela } = useNewParcela('plant-1');
    const result = await handleUpdateParcela('p-1', { nombre: 'Lote A', codigo: 'LA', descripcion: 'x' });
    expect(mockUpdateParcela).toHaveBeenCalledWith('p-1', {
      nombre: 'Lote A',
      codigo: 'LA',
      descripcion: 'x',
    });
    expect(result).toEqual({ success: true });
  });

  test('handleDeleteParcela invoca deleteParcela con el id', async () => {
    mockDeleteParcela.mockResolvedValue({ deleted: true });
    const { handleDeleteParcela } = useNewParcela('plant-1');
    const result = await handleDeleteParcela('p-1');
    expect(mockDeleteParcela).toHaveBeenCalledWith('p-1');
    expect(result).toEqual({ deleted: true });
  });

  test('handleDeleteParcela propaga has_children con conteo', async () => {
    mockDeleteParcela.mockResolvedValue({ deleted: false, error: 'has_children', childCount: 3 });
    const { handleDeleteParcela } = useNewParcela('plant-1');
    const result = await handleDeleteParcela('p-1');
    expect(result).toEqual({ deleted: false, error: 'has_children', childCount: 3 });
  });
});
