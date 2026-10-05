// Botón de especie (#744): orden y tamaños según el estilo de la botonera.
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import SpeciesButton from '../../src/components/SpeciesButton';
import { fonts } from '../../src/theme';

function textos(estilo: Parameters<typeof SpeciesButton>[0]['estilo']) {
  const { UNSAFE_getAllByType } = render(
    <SpeciesButton codigo="LAP" nombre="Lapacho rosado" estilo={estilo} onPress={jest.fn()} />,
  );
  return UNSAFE_getAllByType(Text).map((t) => ({ texto: t.props.children, ...StyleSheet.flatten(t.props.style) }));
}

describe('SpeciesButton', () => {
  it('con el diseño original, el código va arriba en negrita y el nombre abajo sin negrita', () => {
    const [arriba, abajo] = textos({ orden: 'codigo-arriba', tamanoCodigo: 18, tamanoNombre: 11 });
    expect(arriba).toMatchObject({ texto: 'LAP', fontFamily: fonts.bold, fontSize: 18 });
    expect(abajo).toMatchObject({ texto: 'Lapacho rosado', fontFamily: fonts.regular, fontSize: 11 });
  });

  it('con «Nombre arriba», el nombre se renderiza primero y en negrita', () => {
    const [arriba, abajo] = textos({ orden: 'nombre-arriba', tamanoCodigo: 12, tamanoNombre: 16 });
    expect(arriba).toMatchObject({ texto: 'Lapacho rosado', fontFamily: fonts.bold, fontSize: 16 });
    expect(abajo).toMatchObject({ texto: 'LAP', fontFamily: fonts.regular, fontSize: 12 });
  });
});
