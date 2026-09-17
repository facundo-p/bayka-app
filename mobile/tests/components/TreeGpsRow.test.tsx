// Row única bajo la tira: señal GPS + captura del árbol seleccionado (#458).

import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import TreeGpsRow from '../../src/components/TreeGpsRow';
import type { GpsSignalState } from '../../src/components/GpsSignalIndicator';
import { colors } from '../../src/theme';

const SIN_SENAL: GpsSignalState = { lastFix: null, permissionStatus: 'otorgado', servicesEnabled: true };
const noop = () => {};

function renderRow(props: Partial<React.ComponentProps<typeof TreeGpsRow>> = {}) {
  return render(
    <TreeGpsRow
      signal={SIN_SENAL}
      tree={{ hasPoint: true, gpsAccuracy: 3 }}
      capturing={false}
      disabled={false}
      onCapture={noop}
      {...props}
    />,
  );
}

describe('TreeGpsRow', () => {
  it('muestra "Precisión actual" y el semáforo con la leyenda corta', () => {
    const { getByText, getByTestId } = renderRow();
    getByText('Precisión actual');
    getByTestId('gps-signal-indicator');
    getByText('Sin señal');
  });

  it('grupo vacío: la leyenda y el semáforo quedan, sin botón', () => {
    const { getByText, queryByTestId } = renderRow({ tree: null });
    getByText('Precisión actual');
    expect(queryByTestId('capture-gps-button')).toBeNull();
  });

  it('con punto: la precisión del árbol va dentro de Recapturar, con su color', () => {
    const { getByText, getByTestId, UNSAFE_queryByProps } = renderRow({ tree: { hasPoint: true, gpsAccuracy: 13.6 } });
    getByText('Recapturar');
    const accuracy = getByTestId('tree-gps-accuracy');
    expect(accuracy.props.children).toBe('± 14 m');
    expect(StyleSheet.flatten(accuracy.props.style).color).toBe(colors.gpsBad);
    expect(UNSAFE_queryByProps({ name: 'locate-outline' })).toBeNull();
  });

  it('punto sin precisión conocida: "s/d" en gris', () => {
    const { getByTestId } = renderRow({ tree: { hasPoint: true, gpsAccuracy: null } });
    const accuracy = getByTestId('tree-gps-accuracy');
    expect(accuracy.props.children).toBe('s/d');
    expect(StyleSheet.flatten(accuracy.props.style).color).toBe(colors.gpsNone);
  });

  it('sin punto: la mira y "Capturar", sin la leyenda "Sin punto GPS"', () => {
    const { getByText, queryByText, queryByTestId, UNSAFE_getByProps } = renderRow({
      tree: { hasPoint: false, gpsAccuracy: null },
    });
    getByText('Capturar');
    UNSAFE_getByProps({ name: 'locate-outline' });
    expect(queryByTestId('tree-gps-accuracy')).toBeNull();
    expect(queryByText('Sin punto GPS')).toBeNull();
  });

  it('capturando: spinner en lugar de la precisión', () => {
    const { getByTestId, queryByTestId } = renderRow({ capturing: true, disabled: true });
    getByTestId('capture-gps-spinner');
    expect(queryByTestId('tree-gps-accuracy')).toBeNull();
  });

  it('con una captura en curso el botón no dispara otra', () => {
    const onCapture = jest.fn();
    const { getByTestId } = renderRow({ disabled: true, onCapture });
    fireEvent.press(getByTestId('capture-gps-button'));
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('tap dispara la captura', () => {
    const onCapture = jest.fn();
    const { getByTestId } = renderRow({ onCapture });
    fireEvent.press(getByTestId('capture-gps-button'));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });
});
