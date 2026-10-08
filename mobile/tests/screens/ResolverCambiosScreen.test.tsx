import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockUseResolverCambios = jest.fn();

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ plantacionId: 'p1' }) }));
jest.mock('../../src/hooks/useResolverCambios', () => ({
  ...jest.requireActual('../../src/hooks/useResolverCambios'),
  useResolverCambios: () => mockUseResolverCambios(),
}));
jest.mock('../../src/components/ScreenContainer', () => {
  const { View } = require('react-native');
  return function MockScreenContainer({ children }: { children: React.ReactNode }) {
    return <View>{children}</View>;
  };
});
jest.mock('../../src/components/CustomHeader', () => {
  const { Text } = require('react-native');
  return function MockCustomHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return <Text>{`${title} | ${subtitle ?? ''}`}</Text>;
  };
});
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

import ResolverCambiosScreen from '../../src/screens/ResolverCambiosScreen';

const SECCION = {
  clave: 'arbol:t1',
  titulo: 'Árbol L1PT3',
  sub: 'Grupo G12',
  conflictos: [{
    clave: 't1:gps:x',
    eleccion: 'mio',
    vista: {
      titulo: 'Ubicación GPS',
      mio: { origen: 'En este teléfono', valor: '-27.36040, -55.89000' },
      otro: { origen: 'En el servidor', valor: '-27.36000, -55.89000' },
      nota: 'Los dos puntos están a 45 m.',
    },
  }],
};

const ESTADO = {
  lugar: 'Lote Norte', cargando: false, conflictos: [], elecciones: {}, elegir: jest.fn(),
  secciones: [SECCION], elegirEnSync: jest.fn(), cantidad: 1, guardar: jest.fn(), guardando: false,
  error: null, despues: jest.fn(),
};

describe('ResolverCambiosScreen', () => {
  it('muestra la sección del árbol con su tarjeta, y elegir avisa con la clave del conflicto', () => {
    mockUseResolverCambios.mockReturnValue(ESTADO);
    const { getByText, getByLabelText } = render(<ResolverCambiosScreen />);

    expect(getByText('Resolver cambios | Lote Norte · 1 cambio por resolver')).toBeTruthy();
    expect(getByText('Árbol L1PT3')).toBeTruthy();
    expect(getByText('Los dos puntos están a 45 m.')).toBeTruthy();
    expect(getByText('Guardar elección')).toBeTruthy();

    fireEvent.press(getByLabelText('En el servidor: -27.36000, -55.89000'));

    expect(ESTADO.elegirEnSync).toHaveBeenCalledWith('t1:gps:x', 'web');
  });

  it('sin nada por resolver ofrece volver', () => {
    mockUseResolverCambios.mockReturnValue({ ...ESTADO, secciones: [], cantidad: 0 });
    const { getByText, queryByText } = render(<ResolverCambiosScreen />);

    expect(getByText('No hay cambios por resolver.')).toBeTruthy();
    expect(queryByText('Guardar elección')).toBeNull();
  });
});
