// Render tests del semáforo de señal GPS en cada estado.

import React from 'react';
import { render, act } from '@testing-library/react-native';

import GpsSignalIndicator from '../../src/components/GpsSignalIndicator';
import { GPS_FIX_STALE_MS, GPS_SIGNAL_UI_REFRESH_MS } from '../../src/constants/gpsCapture';
import type { GpsFix } from '../../src/services/gps/locationClient';

function fix(accuracy: number | null, timestamp = Date.now()): GpsFix {
  return { latitude: -31, longitude: -60, accuracy, timestamp };
}

describe('GpsSignalIndicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('señal buena: punto verde y metros redondeados', () => {
    const { getByTestId, getByText } = render(
      <GpsSignalIndicator lastFix={fix(2.4)} permissionStatus="otorgado" servicesEnabled={true} />,
    );
    getByTestId('gps-signal-dot-buena');
    getByText('± 2 m');
  });

  it('señal regular: punto amarillo', () => {
    const { getByTestId, getByText } = render(
      <GpsSignalIndicator lastFix={fix(6.7)} permissionStatus="otorgado" servicesEnabled={true} />,
    );
    getByTestId('gps-signal-dot-regular');
    getByText('± 7 m');
  });

  it('señal mala: punto rojo', () => {
    const { getByTestId } = render(
      <GpsSignalIndicator lastFix={fix(25)} permissionStatus="otorgado" servicesEnabled={true} />,
    );
    getByTestId('gps-signal-dot-mala');
  });

  it('sin permiso: estado gris "Sin señal GPS" (no alarmista)', () => {
    const { getByTestId, getByText } = render(
      <GpsSignalIndicator lastFix={null} permissionStatus="denegado" servicesEnabled={true} />,
    );
    getByTestId('gps-signal-dot-sin-senal');
    getByText('Sin señal GPS');
  });

  it('GPS apagado: gris aunque haya fix previo', () => {
    const { getByTestId } = render(
      <GpsSignalIndicator lastFix={fix(2)} permissionStatus="otorgado" servicesEnabled={false} />,
    );
    getByTestId('gps-signal-dot-sin-senal');
  });

  it('fix que envejece sin fixes nuevos degrada a "señal perdida" con el tick', () => {
    const oldFix = fix(2, Date.now());
    const { getByTestId } = render(
      <GpsSignalIndicator lastFix={oldFix} permissionStatus="otorgado" servicesEnabled={true} />,
    );
    getByTestId('gps-signal-dot-buena');

    act(() => {
      jest.advanceTimersByTime(GPS_FIX_STALE_MS + GPS_SIGNAL_UI_REFRESH_MS);
    });
    getByTestId('gps-signal-dot-sin-senal');
  });
});
