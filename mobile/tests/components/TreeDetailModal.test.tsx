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
jest.mock('../../src/components/SeccionEspecie', () => 'SeccionEspecie');

function arbol(fotoSynced: boolean) {
  return {
    id: 't1', posicion: 3, subId: 'A', plantacionCodigo: 'P', especieId: 'e1', especieNombre: 'Ceibo',
    especieNombreCientifico: null, fotoUrl: 'file:///a.jpg', fotoSynced,
    latitude: null, longitude: null, gpsAccuracy: null,
  };
}

function renderModal(over: { onRemovePhoto?: jest.Mock; onCapturePhoto?: jest.Mock; onCaptureGps?: jest.Mock } = {}) {
  const onRemovePhoto = over.onRemovePhoto ?? jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <TreeDetailModal
      visible treeId="t1" plantacionId="p1" canEdit canDelete={false} cambioDeEspecie="disponible"
      onClose={jest.fn()} onReabrirGrupo={jest.fn()}
      onCapturePhoto={over.onCapturePhoto ?? jest.fn()} onRemovePhoto={onRemovePhoto}
      onCaptureGps={over.onCaptureGps ?? jest.fn()} onDelete={jest.fn()}
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
    await waitFor(() => expect(onRemovePhoto).toHaveBeenCalledWith('t1', expect.any(Function)));
  });

  it.each([true, false])('muestra el texto de fotoSynced=%s', (synced) => {
    mockTree = arbol(synced);
    const { getByText } = renderModal();
    fireEvent.press(getByText('Quitar'));
    expect(getByText(textoQuitarFoto(synced))).toBeTruthy();
  });
});

describe('TreeDetailModal: errores de sus acciones (#730)', () => {
  const MENSAJE = 'No se pudo hacer algo.';

  it('quitar foto: el error que reporta la acción se muestra desde el detalle', async () => {
    mockTree = arbol(true);
    const onRemovePhoto = jest.fn((_id: string, onError: (m: string) => void) => { onError(MENSAJE); return Promise.resolve(); });
    const { getAllByText, findByText } = renderModal({ onRemovePhoto });
    fireEvent.press(getAllByText('Quitar')[0]);
    const botones = getAllByText('Quitar');
    fireEvent.press(botones[botones.length - 1]);
    expect(await findByText(MENSAJE)).toBeTruthy();
  });

  it('capturar foto: el error se muestra desde el detalle', async () => {
    mockTree = arbol(true);
    const onCapturePhoto = jest.fn((_id: string, onError: (m: string) => void) => { onError(MENSAJE); return Promise.resolve(); });
    const { getByText, findByText } = renderModal({ onCapturePhoto });
    fireEvent.press(getByText('Cambiar foto'));
    expect(await findByText(MENSAJE)).toBeTruthy();
  });

  it('capturar GPS que lanza: el error se muestra desde el detalle', async () => {
    mockTree = arbol(true);
    const onCaptureGps = jest.fn().mockRejectedValue(new Error(MENSAJE));
    const { getByText, findByText } = renderModal({ onCaptureGps });
    fireEvent.press(getByText('Capturar punto'));
    expect(await findByText(MENSAJE)).toBeTruthy();
  });

  it('capturar GPS sin fix: sigue el aviso en línea, sin diálogo', async () => {
    mockTree = arbol(true);
    const onCaptureGps = jest.fn().mockResolvedValue(false);
    const { getByText, findByText, queryByText } = renderModal({ onCaptureGps });
    fireEvent.press(getByText('Capturar punto'));
    expect(await findByText(/No se pudo capturar el punto\./)).toBeTruthy();
    expect(queryByText('Error')).toBeNull();
  });
});
