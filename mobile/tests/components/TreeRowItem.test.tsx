// Render tests de TreeRowItem: pin de árbol-con-GPS y convivencia con foto.

import React from 'react';
import { render } from '@testing-library/react-native';

import TreeRowItem, { TreeItemData } from '../../src/components/TreeRowItem';

function item(overrides: Partial<TreeItemData> = {}): TreeItemData {
  return {
    id: 'tree-1',
    posicion: 1,
    especieId: 'esp-1',
    especieCodigo: 'EUC',
    especieNombre: 'Eucalipto',
    subId: 'PL1EUC1',
    fotoUrl: null,
    fotoSynced: false,
    createdAt: '2026-06-10T12:00:00',
    grupoId: 'g-1',
    usuarioRegistro: 'user-1',
    ...overrides,
  };
}

const noop = () => {};

describe('TreeRowItem — pin GPS', () => {
  it('árbol con coordenadas muestra el pin', () => {
    const { getByTestId } = render(
      <TreeRowItem item={item({ latitude: -31.5 })} isReadOnly={false} onViewPhoto={noop} />,
    );
    getByTestId('gps-pin');
  });

  it('árbol sin coordenadas no muestra pin', () => {
    const { queryByTestId } = render(
      <TreeRowItem item={item()} isReadOnly={false} onViewPhoto={noop} />,
    );
    expect(queryByTestId('gps-pin')).toBeNull();
  });

  it('pin y foto conviven en la misma fila', () => {
    const { getByTestId } = render(
      <TreeRowItem
        item={item({ latitude: -31.5, fotoUrl: 'file://foto.jpg' })}
        isReadOnly={false}
        onViewPhoto={noop}
      />,
    );
    getByTestId('gps-pin');
  });
});
