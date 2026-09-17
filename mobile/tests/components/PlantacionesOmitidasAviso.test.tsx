import React from 'react';
import { render } from '@testing-library/react-native';
import PlantacionesOmitidasAviso from '../../src/components/PlantacionesOmitidasAviso';

describe('PlantacionesOmitidasAviso (#478)', () => {
  it('muestra el nombre de cada plantación eliminada y sin acceso', () => {
    const { getByText } = render(
      <PlantacionesOmitidasAviso omitidas={{ eliminadas: ['Norte'], sinAcceso: ['Sur'] }} />,
    );

    expect(getByText('Eliminadas en el servidor')).toBeTruthy();
    expect(getByText('Norte')).toBeTruthy();
    expect(getByText('Sin acceso')).toBeTruthy();
    expect(getByText('Sur')).toBeTruthy();
  });

  it('solo el grupo que tiene plantaciones', () => {
    const { queryByText } = render(
      <PlantacionesOmitidasAviso omitidas={{ eliminadas: ['Norte'], sinAcceso: [] }} />,
    );

    expect(queryByText('Sin acceso')).toBeNull();
  });

  it('sin omitidas no renderiza nada', () => {
    const { toJSON } = render(<PlantacionesOmitidasAviso omitidas={{ eliminadas: [], sinAcceso: [] }} />);

    expect(toJSON()).toBeNull();
  });
});
