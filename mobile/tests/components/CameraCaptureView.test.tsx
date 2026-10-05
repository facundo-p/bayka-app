// Cámara in-app (#749): Galería adentro, «Sin foto» con foto opcional y galería también sin permiso de cámara.

import React from 'react';
import { Modal } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';
import CameraCaptureView from '../../src/components/CameraCaptureView';

jest.mock('expo-camera', () => {
  const { View } = require('react-native');
  return { CameraView: View, useCameraPermissions: jest.fn() };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const gesto = () => ({ runOnJS: gesto, onUpdate: gesto, onEnd: gesto });
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pinch: gesto },
  };
});

const mockedPermissions = useCameraPermissions as jest.Mock;

function permiso(granted: boolean) {
  mockedPermissions.mockReturnValue([{ granted, canAskAgain: false }, jest.fn()]);
}

function renderCamara(optional: boolean) {
  const onGallery = jest.fn();
  const onCancel = jest.fn();
  const utils = render(
    <CameraCaptureView visible optional={optional} onCapture={jest.fn()} onGallery={onGallery} onCancel={onCancel} />,
  );
  return { ...utils, onGallery, onCancel };
}

describe('CameraCaptureView con permiso', () => {
  beforeEach(() => permiso(true));

  it('el botón Galería llama a onGallery', () => {
    const { getByText, onGallery } = renderCamara(false);
    fireEvent.press(getByText('Galería'));
    expect(onGallery).toHaveBeenCalledTimes(1);
  });

  it('el back de Android cancela, para no dejar colgado el registro (#659)', () => {
    const { UNSAFE_getByType, onCancel } = renderCamara(true);
    UNSAFE_getByType(Modal).props.onRequestClose();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('con foto opcional ofrece «Sin foto» en vez de la X', () => {
    const { getByText, queryByLabelText, onCancel } = renderCamara(true);
    expect(queryByLabelText('Cerrar cámara')).toBeNull();
    fireEvent.press(getByText('Sin foto'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('con foto obligatoria muestra la X y no «Sin foto»', () => {
    const { getByLabelText, queryByText, onCancel } = renderCamara(false);
    expect(queryByText('Sin foto')).toBeNull();
    fireEvent.press(getByLabelText('Cerrar cámara'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('CameraCaptureView sin permiso de cámara', () => {
  beforeEach(() => permiso(false));

  it('ofrece elegir de la galería', () => {
    const { getByText, onGallery } = renderCamara(false);
    fireEvent.press(getByText('Elegir de la galería'));
    expect(onGallery).toHaveBeenCalledTimes(1);
  });

  it('el link de cancelar dice «Sin foto» con foto opcional', () => {
    const { getByText, queryByText, onCancel } = renderCamara(true);
    expect(queryByText('Cancelar')).toBeNull();
    fireEvent.press(getByText('Sin foto'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('el link de cancelar dice «Cancelar» con foto obligatoria', () => {
    const { getByText, onCancel } = renderCamara(false);
    fireEvent.press(getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
