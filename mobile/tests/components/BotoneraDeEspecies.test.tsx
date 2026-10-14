import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('../../src/components/SpeciesButtonGrid', () => {
  const { Text } = require('react-native');
  return function MockSpeciesButtonGrid({ disabled }: { disabled: boolean }) {
    return <Text testID="grid">{disabled ? 'deshabilitada' : 'habilitada'}</Text>;
  };
});
jest.mock('../../src/components/GpsGateBanner', () => {
  const { Text } = require('react-native');
  return function MockGpsGateBanner({ message }: { message: string }) {
    return <Text testID="banner">{message}</Text>;
  };
});

import BotoneraDeEspecies from '../../src/components/BotoneraDeEspecies';

const LIBRE = { blocked: false, message: null, unblocking: false, requestUnblock: jest.fn() };
const BLOQUEADA = { ...LIBRE, blocked: true, message: 'Activá el GPS' };

function renderCon(props: Partial<React.ComponentProps<typeof BotoneraDeEspecies>>) {
  return render(
    <BotoneraDeEspecies
      gpsGate={LIBRE}
      loading={false}
      species={[]}
      estilo={{} as any}
      disabled={false}
      onSelectSpecies={jest.fn()}
      onNNPress={jest.fn()}
      {...props}
    />,
  );
}

describe('BotoneraDeEspecies', () => {
  it('GPS libre: grilla habilitada y sin aviso', () => {
    const screen = renderCon({});
    expect(screen.getByTestId('grid').props.children).toBe('habilitada');
    expect(screen.queryByTestId('banner')).toBeNull();
  });

  it('GPS bloqueado: aviso con su mensaje y grilla deshabilitada', () => {
    const screen = renderCon({ gpsGate: BLOQUEADA });
    expect(screen.getByTestId('banner').props.children).toBe('Activá el GPS');
    expect(screen.getByTestId('grid').props.children).toBe('deshabilitada');
  });

  it('disabled deshabilita la grilla aunque el GPS esté libre', () => {
    expect(renderCon({ disabled: true }).getByTestId('grid').props.children).toBe('deshabilitada');
  });

  it('cargando especies: spinner en lugar de la grilla', () => {
    const screen = renderCon({ loading: true });
    expect(screen.queryByTestId('grid')).toBeNull();
    expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
  });
});
