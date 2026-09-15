// Tira deslizable de árboles con selección (#459).

import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import TreeStrip, { type TreeChipItem } from '../../src/components/TreeStrip';

function chip(posicion: number, extra: Partial<TreeChipItem> = {}): TreeChipItem {
  return {
    id: `t${posicion}`,
    posicion,
    especieId: 'esp-1',
    especieCodigo: 'LA',
    subId: `L1LA${posicion}`,
    createdAt: '2026-09-15T10:00:00Z',
    grupoId: 'g1',
    usuarioRegistro: 'u1',
    ...extra,
  };
}

const TREES = [chip(1, { latitude: -31 }), chip(2), chip(3), chip(4), chip(5)];

function renderStrip(props: Partial<React.ComponentProps<typeof TreeStrip>> = {}) {
  return render(
    <TreeStrip trees={TREES} selectedId="t5" onSelect={jest.fn()} onDelete={jest.fn()} {...props} />,
  );
}

describe('TreeStrip', () => {
  it('muestra todos los árboles del grupo, del más viejo al más nuevo', () => {
    const { getAllByTestId } = renderStrip();
    const ids = getAllByTestId(/^tree-chip-/).map((el) => el.props.testID);
    expect(ids).toEqual(['tree-chip-t1', 'tree-chip-t2', 'tree-chip-t3', 'tree-chip-t4', 'tree-chip-t5']);
  });

  it('el tachito va solo en el chip seleccionado', () => {
    const onDelete = jest.fn();
    const { getAllByTestId } = renderStrip({ selectedId: 't2', onDelete });
    const trash = getAllByTestId('delete-tree-button');
    expect(trash).toHaveLength(1);

    fireEvent.press(trash[0]);

    expect(onDelete).toHaveBeenCalledWith(TREES[1]);
  });

  it('tocar un chip lo selecciona', () => {
    const onSelect = jest.fn();
    const { getByTestId } = renderStrip({ onSelect });
    fireEvent.press(getByTestId('tree-chip-t3'));
    expect(onSelect).toHaveBeenCalledWith('t3');
  });

  it('marca con pin los árboles con punto GPS', () => {
    const { UNSAFE_getAllByProps } = renderStrip();
    // El icono matchea dos veces (wrapper e Icon interno): se comparan los testID.
    const pinIds = new Set(UNSAFE_getAllByProps({ name: 'location' }).map((pin) => pin.props.testID));
    expect([...pinIds]).toEqual(['chip-gps-pin-t1']);
  });

  it('con menos de 3 árboles completa los lugares vacíos', () => {
    const { getAllByTestId } = renderStrip({ trees: [chip(1)], selectedId: 't1' });
    expect(getAllByTestId('tree-strip-empty-slot')).toHaveLength(2);
  });

  it('grupo vacío: 3 lugares vacíos, sin tachito', () => {
    const { getAllByTestId, queryByTestId } = renderStrip({ trees: [], selectedId: null });
    expect(getAllByTestId('tree-strip-empty-slot')).toHaveLength(3);
    expect(queryByTestId('delete-tree-button')).toBeNull();
  });

  it('muestra la row que recibe como footer', () => {
    const { getByText } = renderStrip({ footer: <Text>footer</Text> });
    getByText('footer');
  });
});
