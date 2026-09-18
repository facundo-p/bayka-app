import React from 'react';
import { render } from '@testing-library/react-native';
import PlantationDetailHeader from '../../src/components/PlantationDetailHeader';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/components/FilterCards', () => () => null);

function renderHeader(estado: { isFinalizada?: boolean; isArchivada?: boolean; isEliminada?: boolean }) {
  return render(
    <PlantationDetailHeader
      estadoLoaded
      isFinalizada={estado.isFinalizada ?? false}
      isArchivada={estado.isArchivada ?? false}
      isEliminada={estado.isEliminada ?? false}
      groupFilter={null}
      groupFilterConfigs={[]}
      onToggleFilter={jest.fn()}
    />,
  );
}

describe('PlantationDetailHeader — banner de estado', () => {
  it('eliminada en el servidor gana sobre archivada y finalizada (#478)', () => {
    const { getByText, queryByText } = renderHeader({ isFinalizada: true, isArchivada: true, isEliminada: true });

    expect(getByText('Eliminada en el servidor')).toBeTruthy();
    expect(queryByText('Plantación archivada')).toBeNull();
    expect(queryByText('Plantación finalizada')).toBeNull();
  });

  it('archivada gana sobre finalizada', () => {
    const { getByText, queryByText } = renderHeader({ isFinalizada: true, isArchivada: true });

    expect(getByText('Plantación archivada')).toBeTruthy();
    expect(queryByText('Plantación finalizada')).toBeNull();
  });

  it('activa sin marcas: sin banner', () => {
    const { queryByText } = renderHeader({});

    expect(queryByText('Eliminada en el servidor')).toBeNull();
    expect(queryByText('Plantación archivada')).toBeNull();
    expect(queryByText('Plantación finalizada')).toBeNull();
  });
});
