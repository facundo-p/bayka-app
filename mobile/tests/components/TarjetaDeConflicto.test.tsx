import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import TarjetaDeConflicto from '../../src/components/TarjetaDeConflicto';
import type { ConflictoDeCampo } from '../../src/utils/conflictosDeEdicion';

const CONFLICTO: ConflictoDeCampo = {
  campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000,
  editadoPor: 'Ana', editadoEn: null, mioEn: null,
};

describe('TarjetaDeConflicto', () => {
  it('muestra los dos cambios y el valor anterior, y elegir avisa cuál', () => {
    const onElegir = jest.fn();
    const { getByText, getByLabelText } = render(
      <TarjetaDeConflicto conflicto={CONFLICTO} eleccion="mio" onElegir={onElegir} />,
    );

    expect(getByText('Objetivo de árboles')).toBeTruthy();
    expect(getByText('Antes de los dos cambios: 12.000')).toBeTruthy();
    expect(getByLabelText('Tu cambio · este teléfono: 15.000').props.accessibilityState).toEqual({ checked: true });

    fireEvent.press(getByLabelText('En la web · Ana: 12.500'));

    expect(onElegir).toHaveBeenCalledWith('web');
  });
});
