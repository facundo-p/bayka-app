// Aviso del punto GPS del toque en la cámara (#912).

import React from 'react';
import { act, render, renderHook } from '@testing-library/react-native';
import AvisoPuntoGps from '../../src/components/AvisoPuntoGps';
import { GPS_AVISO_RESUELTO_MS } from '../../src/constants/gpsCapture';
import { AVISO_PUNTO_GPS, useAvisoPuntoGps } from '../../src/hooks/useAvisoPuntoGps';
import type { GpsFix } from '../../src/services/gps/locationClient';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

const FIX: GpsFix = { latitude: -31, longitude: -60, accuracy: 4, timestamp: 0 };

function puntoControlado() {
  let resolver: (fix: GpsFix | null) => void = () => {};
  const punto = new Promise<GpsFix | null>((resolve) => { resolver = resolve; });
  return { punto, llega: (fix: GpsFix | null) => act(async () => { resolver(fix); await punto; }) };
}

describe('useAvisoPuntoGps', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sin punto en camino no hay aviso', () => {
    const { result } = renderHook(() => useAvisoPuntoGps(undefined));
    expect(result.current).toBeNull();
  });

  it('espera, al llegar muestra la precisión y después se oculta', async () => {
    const { punto, llega } = puntoControlado();
    const { result } = renderHook(() => useAvisoPuntoGps(punto));
    expect(result.current).toEqual({ estado: 'esperando' });

    await llega(FIX);
    expect(result.current).toEqual({ estado: 'tomado', precision: 4 });

    act(() => { jest.advanceTimersByTime(GPS_AVISO_RESUELTO_MS); });
    expect(result.current).toBeNull();
  });

  it('sin fix avisa que el árbol queda sin punto', async () => {
    const { punto, llega } = puntoControlado();
    const { result } = renderHook(() => useAvisoPuntoGps(punto));

    await llega(null);

    expect(result.current).toEqual({ estado: 'sin-punto' });
  });

  it('el mismo punto no se vuelve a anunciar (reabrir la cámara desde el recorte)', async () => {
    const { punto, llega } = puntoControlado();
    const { result, rerender } = renderHook(({ p }) => useAvisoPuntoGps(p), { initialProps: { p: punto } });
    await llega(FIX);
    act(() => { jest.advanceTimersByTime(GPS_AVISO_RESUELTO_MS); });

    rerender({ p: punto });

    expect(result.current).toBeNull();
  });
});

describe('AvisoPuntoGps', () => {
  it('sin aviso no muestra nada', () => {
    const { queryByTestId } = render(<AvisoPuntoGps aviso={null} />);
    expect(queryByTestId('aviso-punto-gps')).toBeNull();
  });

  it('esperando: spinner y "Tomando punto GPS…"', () => {
    const { getByText, getByTestId } = render(<AvisoPuntoGps aviso={{ estado: AVISO_PUNTO_GPS.esperando }} />);
    getByText('Tomando punto GPS…');
    getByTestId('aviso-gps-spinner');
  });

  it('tomado: la precisión del punto', () => {
    const { getByText } = render(<AvisoPuntoGps aviso={{ estado: AVISO_PUNTO_GPS.tomado, precision: 4 }} />);
    getByText('Punto GPS tomado · ± 4 m');
  });

  it('sin punto', () => {
    const { getByText } = render(<AvisoPuntoGps aviso={{ estado: AVISO_PUNTO_GPS.sinPunto }} />);
    getByText('Sin punto GPS');
  });
});
