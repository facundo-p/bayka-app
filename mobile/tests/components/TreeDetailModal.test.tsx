// «Quitar» foto en el detalle del árbol pide confirmación (#724).

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TreeDetailModal from '../../src/components/TreeDetailModal';
import { textoQuitarFoto, TITULO_QUITAR_FOTO } from '../../src/utils/avisoQuitarFoto';

let mockTree: Record<string, unknown> | null;

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/components/FotoRemota', () => 'FotoRemota');
jest.mock('../../src/components/PhotoViewer', () => 'PhotoViewer');
jest.mock('../../src/hooks/useTreeDetail', () => ({ useTreeDetail: () => mockTree }));

function arbol(fotoSynced: boolean) {
  return {
    id: 't1', posicion: 3, subId: 'A', plantacionCodigo: 'P', especieId: 'e1', especieNombre: 'Ceibo',
    especieNombreCientifico: null, fotoUrl: 'file:///a.jpg', fotoSynced,
    latitude: null, longitude: null, gpsAccuracy: null,
  };
}

function renderModal() {
  const onRemovePhoto = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <TreeDetailModal
      visible treeId="t1" canEdit canDelete={false} onClose={jest.fn()}
      onCapturePhoto={jest.fn()} onRemovePhoto={onRemovePhoto} onCaptureGps={jest.fn()} onDelete={jest.fn()}
    />,
  );
  return { ...utils, onRemovePhoto };
}

describe('TreeDetailModal: quitar foto', () => {
  it('abre la confirmación sin borrar todavía', () => {
    mockTree = arbol(true);
    const { getByText, onRemovePhoto } = renderModal();
    fireEvent.press(getByText('Quitar'));
    expect(getByText(TITULO_QUITAR_FOTO)).toBeTruthy();
    expect(onRemovePhoto).not.toHaveBeenCalled();
  });

  it('cancelar deja la foto', () => {
    mockTree = arbol(true);
    const { getByText, onRemovePhoto } = renderModal();
    fireEvent.press(getByText('Quitar'));
    fireEvent.press(getByText('Cancelar'));
    expect(onRemovePhoto).not.toHaveBeenCalled();
  });

  it('confirmar quita la foto', async () => {
    mockTree = arbol(true);
    const { getAllByText, onRemovePhoto } = renderModal();
    fireEvent.press(getAllByText('Quitar')[0]);
    const botones = getAllByText('Quitar');
    fireEvent.press(botones[botones.length - 1]);
    await waitFor(() => expect(onRemovePhoto).toHaveBeenCalledWith('t1'));
  });

  it.each([true, false])('muestra el texto de fotoSynced=%s', (synced) => {
    mockTree = arbol(synced);
    const { getByText } = renderModal();
    fireEvent.press(getByText('Quitar'));
    expect(getByText(textoQuitarFoto(synced))).toBeTruthy();
  });
});
