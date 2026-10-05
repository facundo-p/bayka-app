// Botonera de especies: el estilo elegido vale para todos los botones, también el N/N.
import React from 'react';
import { render, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import SpeciesButtonGrid from '../../src/components/SpeciesButtonGrid';
import { fonts } from '../../src/theme';

const ESPECIES = [
  { id: 'e1', plantacionId: 'p1', especieId: 'e1', codigo: 'TIM', nombre: 'Timbó', nombreCientifico: null, ordenVisual: 0 },
];

describe('SpeciesButtonGrid', () => {
  it('con «Nombre arriba», el N/N también muestra el nombre primero, en negrita y con su tamaño', () => {
    const { getByTestId } = render(
      <SpeciesButtonGrid
        species={ESPECIES}
        estilo={{ orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 }}
        onSelectSpecies={jest.fn()}
        onNNPress={jest.fn()}
      />,
    );
    for (const [testID, nombre] of [['species-btn-TIM', 'Timbó'], ['nn-button', 'No identificado']]) {
      const [arriba, abajo] = within(getByTestId(testID))
        .UNSAFE_getAllByType(Text)
        .map((t) => ({ texto: t.props.children, ...StyleSheet.flatten(t.props.style) }));
      expect(arriba).toMatchObject({ texto: nombre, fontFamily: fonts.bold, fontSize: 16 });
      expect(abajo).toMatchObject({ fontFamily: fonts.regular, fontSize: 12 });
    }
  });
});
