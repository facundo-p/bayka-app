// Borrar una parcela que nunca subió no tiene vuelta atrás: se confirma antes (#654).

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ParcelaFormModal from '../../src/components/ParcelaFormModal';
import type { Parcela } from '../../src/repositories/ParcelaRepository';

const mockHandleDeleteParcela = jest.fn();
const mockHandleUpdateParcela = jest.fn();

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/hooks/useNewParcela', () => ({
  useNewParcela: () => ({
    handleCreateParcela: jest.fn(),
    handleUpdateParcela: mockHandleUpdateParcela,
    handleDeleteParcela: mockHandleDeleteParcela,
  }),
}));

const SUBIDA: Parcela = {
  id: 'par-1', plantacionId: 'p-1', nombre: 'Lote 1', codigo: 'L1', descripcion: null, pendingSync: false,
  createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null, altaPendienteDe: null,
};
const SIN_SUBIR: Parcela = { ...SUBIDA, pendingSync: true, altaPendienteDe: 'ana' };

function renderEdicion(parcela: Parcela) {
  return render(<ParcelaFormModal visible mode="edit" plantacionId="p-1" parcela={parcela} onClose={jest.fn()} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleDeleteParcela.mockResolvedValue({ deleted: true });
});

describe('ParcelaFormModal — eliminar', () => {
  it('una parcela sin subir pide confirmación antes de borrar', async () => {
    const { getByText } = renderEdicion(SIN_SUBIR);

    fireEvent.press(getByText('Eliminar parcela'));
    expect(getByText(/no queda copia en el servidor/)).toBeTruthy();
    expect(mockHandleDeleteParcela).not.toHaveBeenCalled();

    fireEvent.press(getByText('Eliminar'));
    await waitFor(() => expect(mockHandleDeleteParcela).toHaveBeenCalledWith('par-1'));
  });

  it('cancelar la confirmación no borra', () => {
    const { getByText, getAllByText, queryByText } = renderEdicion(SIN_SUBIR);
    fireEvent.press(getByText('Eliminar parcela'));
    // El primero es el del pie del formulario; el de la confirmación va después.
    fireEvent.press(getAllByText('Cancelar').at(-1)!);
    expect(queryByText(/no queda copia en el servidor/)).toBeNull();
    expect(mockHandleDeleteParcela).not.toHaveBeenCalled();
  });

  it('una parcela subida se borra sin esa confirmación', async () => {
    const { getByText, queryByText } = renderEdicion(SUBIDA);
    fireEvent.press(getByText('Eliminar parcela'));
    expect(queryByText(/no queda copia en el servidor/)).toBeNull();
    await waitFor(() => expect(mockHandleDeleteParcela).toHaveBeenCalledWith('par-1'));
  });

  it('sin permiso explica que la parcela ya se sincronizó', async () => {
    mockHandleDeleteParcela.mockResolvedValue({ deleted: false, error: 'sin_permiso' });
    const { getByText } = renderEdicion(SUBIDA);
    fireEvent.press(getByText('Eliminar parcela'));
    await waitFor(() =>
      expect(getByText('Solo un administrador puede editar o eliminar una parcela que ya se sincronizó.')).toBeTruthy(),
    );
  });
});
