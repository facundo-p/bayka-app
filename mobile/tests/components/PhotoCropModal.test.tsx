// Recorte cuadrado (#831): arranca en el cuadrado centrado más grande y no hay forma de guardar la foto entera.

import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import PhotoCropModal from '../../src/components/PhotoCropModal';
import { cropResizeAndSave } from '../../src/services/PhotoService';
import { avisoBreve } from '../../src/utils/avisoBreve';

jest.mock('../../src/services/PhotoService', () => ({ cropResizeAndSave: jest.fn() }));
jest.mock('../../src/utils/avisoBreve', () => ({ avisoBreve: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

const mockedSave = cropResizeAndSave as jest.Mock;
const FOTO = { uri: 'file:///raw.jpg', width: 3000, height: 4000 };
// 3000×4000 en 360×600 se ve de 360×480 desde y=60; el cuadrado centrado es 360×360 desde y=120.
const STAGE = { width: 360, height: 600 };

function renderRecorte(raw = FOTO) {
  const props = { onCancel: jest.fn(), onSave: jest.fn(), onRetry: jest.fn() };
  render(<PhotoCropModal raw={raw} {...props} />);
  fireEvent(screen.getByTestId('crop-stage'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, ...STAGE } } });
  return props;
}

beforeEach(() => jest.clearAllMocks());

it('el marco arranca en el cuadrado centrado más grande', () => {
  renderRecorte();
  const estilo = StyleSheet.flatten(screen.getByTestId('crop-frame').props.style);
  expect(estilo).toMatchObject({ left: 0, top: 120, width: 360, height: 360 });
});

it('guardar sin tocar el marco recorta ese cuadrado, no la foto entera', async () => {
  mockedSave.mockResolvedValue('file:///photos/photo_1.jpg');
  const { onSave } = renderRecorte();
  await act(async () => { fireEvent.press(screen.getByLabelText('Guardar foto')); });
  expect(mockedSave).toHaveBeenCalledWith(FOTO.uri, { originX: 0, originY: 500, width: 3000, height: 3000 });
  expect(onSave).toHaveBeenCalledWith('file:///photos/photo_1.jpg');
});

it('si el guardado falla avisa y deja el recorte abierto, sin reintentar con la foto entera', async () => {
  mockedSave.mockRejectedValue(new Error('disco lleno'));
  const consola = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { onSave, onCancel } = renderRecorte();
  await act(async () => { fireEvent.press(screen.getByLabelText('Guardar foto')); });
  expect(mockedSave).toHaveBeenCalledTimes(1);
  expect(avisoBreve).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
  expect(screen.getByTestId('crop-frame')).toBeTruthy();
  consola.mockRestore();
});

it('si no se puede medir la foto de la galería avisa y vuelve a la cámara', () => {
  const getSize = jest.spyOn(Image, 'getSize').mockImplementation((_uri, _ok, fallo) => fallo?.(new Error('x')));
  const { onRetry, onSave } = renderRecorte({ uri: 'content://galeria/1', width: 0, height: 0 });
  expect(avisoBreve).toHaveBeenCalledTimes(1);
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
  getSize.mockRestore();
});

it('la foto de la galería sin tamaño se mide antes de armar el marco', () => {
  const getSize = jest.spyOn(Image, 'getSize').mockImplementation((_uri, ok) => ok(4000, 3000));
  renderRecorte({ uri: 'content://galeria/1', width: 0, height: 0 });
  // 4000×3000 en 360×600 se ve de 360×270 desde y=165: cuadrado de 270 centrado.
  const estilo = StyleSheet.flatten(screen.getByTestId('crop-frame').props.style);
  expect(estilo).toMatchObject({ left: 45, top: 165, width: 270, height: 270 });
  getSize.mockRestore();
});
