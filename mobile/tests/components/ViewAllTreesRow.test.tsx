import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

import ViewAllTreesRow from '../../src/components/ViewAllTreesRow';

describe('ViewAllTreesRow', () => {
  it('con árboles: abre la lista', () => {
    const onPress = jest.fn();
    const screen = render(<ViewAllTreesRow totalCount={3} onPress={onPress} />);
    fireEvent.press(screen.getByText('Ver todos los árboles'));
    expect(onPress).toHaveBeenCalled();
  });

  it('sin árboles: lo dice y no abre nada', () => {
    const onPress = jest.fn();
    const screen = render(<ViewAllTreesRow totalCount={0} onPress={onPress} />);
    fireEvent.press(screen.getByText('Sin árboles cargados'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
