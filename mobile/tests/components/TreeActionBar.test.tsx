import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = require('react-native');
  return function MockIonicons({ name }: { name: string }) {
    return <Text>{name}</Text>;
  };
});

import TreeActionBar from '../../src/components/TreeActionBar';

function setup(overrides: Partial<React.ComponentProps<typeof TreeActionBar>> = {}) {
  const props = {
    deleting: false,
    finalizing: false,
    foto: { fotografiar: jest.fn(), capturando: false, deshabilitado: false },
    seleccionadoSubId: 'A-14',
    onDeleteGroup: jest.fn(),
    onOpenConfig: jest.fn(),
    onFinalizar: jest.fn(),
    ...overrides,
  };
  return { props, screen: render(<TreeActionBar {...props} />) };
}

describe('TreeActionBar', () => {
  it('orden: eliminar grupo, engranaje, foto, Finalizar', () => {
    const { screen } = setup();
    const textos = screen.getAllByText(/./).map((t) => t.props.children);
    expect(textos).toEqual(['trash-outline', 'settings-outline', 'camera-outline', 'Finalizar']);
  });

  it('cada botón dispara su acción', () => {
    const { screen, props } = setup();
    fireEvent.press(screen.getByText('trash-outline'));
    fireEvent.press(screen.getByText('settings-outline'));
    fireEvent.press(screen.getByTestId('foto-seleccionado-button'));
    fireEvent.press(screen.getByTestId('finalize-button'));
    expect(props.onDeleteGroup).toHaveBeenCalled();
    expect(props.onOpenConfig).toHaveBeenCalled();
    expect(props.foto.fotografiar).toHaveBeenCalled();
    expect(props.onFinalizar).toHaveBeenCalled();
  });

  it('el botón de foto nombra al árbol seleccionado', () => {
    expect(setup().screen.getByLabelText('Foto de A-14')).toBeTruthy();
    expect(setup({ seleccionadoSubId: null }).screen.getByLabelText('Foto del árbol seleccionado')).toBeTruthy();
  });

  it('en curso: spinner en lugar del ícono y botón deshabilitado', () => {
    const { screen } = setup({
      deleting: true,
      finalizing: true,
      foto: { fotografiar: jest.fn(), capturando: true, deshabilitado: true },
    });
    expect(screen.queryByText('trash-outline')).toBeNull();
    expect(screen.queryByText('camera-outline')).toBeNull();
    expect(screen.queryByText('Finalizar')).toBeNull();
    expect(screen.getByTestId('finalize-button').props.accessibilityState).toMatchObject({ disabled: true });
  });
});
