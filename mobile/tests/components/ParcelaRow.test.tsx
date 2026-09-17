// Sin onLongPress no hay puerta a editar/eliminar la parcela (#469), y el hint de
// accesibilidad no puede seguir prometiendo una acción que ya no existe.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ParcelaRow from '../../src/components/ParcelaRow';
import type { ParcelaWithStats } from '../../src/queries/parcelaQueries';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');

const PARCELA: ParcelaWithStats = {
  id: 'par-1',
  plantacionId: 'p-1',
  nombre: 'Parcela Norte',
  codigo: 'PN',
  descripcion: null,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  pendingSync: false,
  pendingSyncBelow: false,
  gruposCount: 2,
  treesCount: 10,
  nnCount: 0,
};

describe('ParcelaRow', () => {
  it('con onLongPress: lo dispara y anuncia que se puede editar', () => {
    const onLongPress = jest.fn();
    const { getByLabelText } = render(
      <ParcelaRow parcela={PARCELA} onPress={jest.fn()} onLongPress={onLongPress} />,
    );

    const fila = getByLabelText('Parcela Parcela Norte');
    fireEvent(fila, 'longPress');

    expect(onLongPress).toHaveBeenCalled();
    expect(fila.props.accessibilityHint).toMatch(/editar/);
  });

  it('sin onLongPress: no anuncia la edición', () => {
    const { getByLabelText } = render(
      <ParcelaRow parcela={PARCELA} onPress={jest.fn()} />,
    );

    expect(getByLabelText('Parcela Parcela Norte').props.accessibilityHint).not.toMatch(/editar/);
  });

  it('muestra los contadores de la parcela', () => {
    const { getByText } = render(<ParcelaRow parcela={PARCELA} onPress={jest.fn()} />);

    expect(getByText('2')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
  });

  it('sin onLongPress: el toque simple sigue navegando', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <ParcelaRow parcela={PARCELA} onPress={onPress} />,
    );

    fireEvent.press(getByLabelText('Parcela Parcela Norte'));

    expect(onPress).toHaveBeenCalled();
  });
});
