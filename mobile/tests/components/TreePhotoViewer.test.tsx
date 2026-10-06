// Visor de la foto de un árbol (#745): Reemplazar y Eliminar foto solo con permiso de edición.

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TreePhotoViewer from '../../src/components/TreePhotoViewer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/components/FotoRemota', () => 'FotoRemota');
jest.mock('react-native-reanimated', () => {
  const { Image } = require('react-native');
  return {
    __esModule: true,
    default: { Image },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
  };
});
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const gesto = () => ({ onUpdate: gesto, onEnd: gesto, numberOfTaps: gesto });
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pinch: gesto, Pan: gesto, Tap: gesto, Simultaneous: gesto },
  };
});

const FOTO = { uri: 'file:///a.jpg', treeId: 'tree-1' };

function renderVisor(canEdit: boolean) {
  const onReplace = jest.fn();
  const onRemove = jest.fn();
  const utils = render(
    <TreePhotoViewer foto={FOTO} canEdit={canEdit} onClose={jest.fn()} onReplace={onReplace} onRemove={onRemove} />,
  );
  return { ...utils, onReplace, onRemove };
}

describe('TreePhotoViewer', () => {
  it('sin permiso de edición muestra solo la foto, sin Reemplazar ni Eliminar foto', () => {
    const { queryByTestId, queryByText } = renderVisor(false);
    expect(queryByTestId('photo-viewer-actions')).toBeNull();
    expect(queryByText('Reemplazar')).toBeNull();
    expect(queryByText('Eliminar foto')).toBeNull();
  });

  it('con permiso de edición ofrece Reemplazar y Eliminar foto sobre el árbol que se está viendo', () => {
    const { getByText, onReplace, onRemove } = renderVisor(true);
    fireEvent.press(getByText('Reemplazar'));
    fireEvent.press(getByText('Eliminar foto'));
    expect(onReplace).toHaveBeenCalledWith(FOTO);
    expect(onRemove).toHaveBeenCalledWith('tree-1');
  });

  it('abierto desde Ver actual de un aviso, Reemplazar avisa que el reemplazo ya se confirmó (#750)', () => {
    const onReplace = jest.fn();
    const foto = { ...FOTO, reemplazoConfirmado: true };
    const { getByText } = render(
      <TreePhotoViewer foto={foto} canEdit onClose={jest.fn()} onReplace={onReplace} onRemove={jest.fn()} />,
    );
    fireEvent.press(getByText('Reemplazar'));
    expect(onReplace).toHaveBeenCalledWith(foto);
  });

  it('sin foto no se abre', () => {
    const { queryByTestId } = render(
      <TreePhotoViewer foto={null} canEdit onClose={jest.fn()} onReplace={jest.fn()} onRemove={jest.fn()} />,
    );
    expect(queryByTestId('photo-viewer-close')).toBeNull();
  });
});
