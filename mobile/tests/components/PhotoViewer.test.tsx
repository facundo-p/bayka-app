// Visor de fotos (#702): ✕ y barra de acciones respetan los insets del sistema.

import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import PhotoViewer from '../../src/components/PhotoViewer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 30, bottom: 20, left: 0, right: 0 }),
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

describe('PhotoViewer safe area', () => {
  it('baja la ✕ por debajo de la barra de estado', () => {
    const { getByTestId } = render(<PhotoViewer uri="file:///a.jpg" onClose={jest.fn()} />);
    const { top } = StyleSheet.flatten(getByTestId('photo-viewer-close').props.style);
    expect(top).toBeGreaterThanOrEqual(30);
  });

  it('separa las acciones de la barra de navegación', () => {
    const { getByTestId } = render(
      <PhotoViewer uri="file:///a.jpg" onClose={jest.fn()} onReplace={jest.fn()} onRemove={jest.fn()} />,
    );
    const { paddingBottom } = StyleSheet.flatten(getByTestId('photo-viewer-actions').props.style);
    expect(paddingBottom).toBeGreaterThanOrEqual(20);
  });
});
