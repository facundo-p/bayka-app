// «Quitar» (#724) y «Cambiar foto» (#750) en el detalle del árbol piden confirmación.

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import TreeDetailModal from '../../src/components/TreeDetailModal';
import { textoQuitarFoto, TITULO_QUITAR_FOTO } from '../../src/utils/avisoQuitarFoto';
import { textoReemplazarFoto, TITULO_REEMPLAZAR_FOTO } from '../../src/utils/avisoReemplazarFoto';

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

describe('TreeDetailModal: cambiar foto (#750)', () => {
  function visor(utils: ReturnType<typeof renderModal>) {
    return utils.UNSAFE_getByType('PhotoViewer' as any).props;
  }

  it('con foto abre el aviso sin abrir la cámara todavía', () => {
    mockTree = arbol(true);
    const onCapturePhoto = jest.fn().mockResolvedValue(undefined);
    const { getByText } = renderModal({ onCapturePhoto });
    fireEvent.press(getByText('Cambiar foto'));
    expect(getByText(TITULO_REEMPLAZAR_FOTO)).toBeTruthy();
    expect(getByText(textoReemplazarFoto('A', true))).toBeTruthy();
    expect(getByText('Ver actual')).toBeTruthy();
    expect(onCapturePhoto).not.toHaveBeenCalled();
  });

  it('sin foto va directo a la cámara', () => {
    mockTree = { ...arbol(true), fotoUrl: null };
    const onCapturePhoto = jest.fn().mockResolvedValue(undefined);
    const { getByText, queryByText } = renderModal({ onCapturePhoto });
    fireEvent.press(getByText('Tomar foto'));
    expect(queryByText(TITULO_REEMPLAZAR_FOTO)).toBeNull();
    expect(onCapturePhoto).toHaveBeenCalledWith('t1', expect.any(Function));
  });

  it('cancelar no abre la cámara', () => {
    mockTree = arbol(false);
    const onCapturePhoto = jest.fn().mockResolvedValue(undefined);
    const { getByText } = renderModal({ onCapturePhoto });
    fireEvent.press(getByText('Cambiar foto'));
    fireEvent.press(getByText('Cancelar'));
    expect(onCapturePhoto).not.toHaveBeenCalled();
  });

  it('Reemplazar en el aviso abre la cámara', async () => {
    mockTree = arbol(true);
    const onCapturePhoto = jest.fn().mockResolvedValue(undefined);
    const { getByText } = renderModal({ onCapturePhoto });
    fireEvent.press(getByText('Cambiar foto'));
    fireEvent.press(getByText('Reemplazar'));
    await waitFor(() => expect(onCapturePhoto).toHaveBeenCalledWith('t1', expect.any(Function)));
  });

  it('ampliar la foto es solo lectura', () => {
    mockTree = arbol(true);
    const utils = renderModal();
    fireEvent.press(utils.getByLabelText('Ampliar foto'));
    expect(visor(utils).uri).toBe('file:///a.jpg');
    expect(visor(utils).onReplace).toBeUndefined();
  });

  it('desde Ver actual, Reemplazar cierra el visor y abre la cámara sin volver a preguntar', async () => {
    mockTree = arbol(true);
    const onCapturePhoto = jest.fn().mockResolvedValue(undefined);
    const utils = renderModal({ onCapturePhoto });
    fireEvent.press(utils.getByText('Cambiar foto'));
    fireEvent.press(utils.getByText('Ver actual'));
    expect(visor(utils).uri).toBe('file:///a.jpg');
    expect(onCapturePhoto).not.toHaveBeenCalled();

    act(() => visor(utils).onReplace());
    expect(visor(utils).uri).toBeNull();
    expect(utils.queryByText(TITULO_REEMPLAZAR_FOTO)).toBeNull();
    await waitFor(() => expect(onCapturePhoto).toHaveBeenCalledWith('t1', expect.any(Function)));
  });

  it('Ver actual de una foto que está solo en la nube la abre en el visor con su árbol', () => {
    mockTree = { ...arbol(true), fotoUrl: 'plantaciones/p1/t1.jpg' };
    const utils = renderModal();
    fireEvent.press(utils.getByText('Cambiar foto'));
    fireEvent.press(utils.getByText('Ver actual'));
    expect(visor(utils)).toMatchObject({ uri: 'plantaciones/p1/t1.jpg', treeId: 't1' });
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
    fireEvent.press(getByText('Reemplazar'));
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
