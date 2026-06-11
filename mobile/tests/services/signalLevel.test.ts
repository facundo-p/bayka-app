// Tests de la función pura accuracy → nivel del semáforo (valores límite).

import {
  GPS_ACCURACY_GOOD_MAX_METERS,
  GPS_ACCURACY_REGULAR_MAX_METERS,
  GPS_FIX_STALE_MS,
} from '../../src/constants/gpsCapture';
import { getGpsSignalLevel, GpsSignalParams } from '../../src/services/gps/signalLevel';

const NOW = 1_700_000_000_000;

function params(overrides: Partial<GpsSignalParams> = {}): GpsSignalParams {
  return {
    permissionStatus: 'otorgado',
    servicesEnabled: true,
    fix: { latitude: -31, longitude: -60, accuracy: 5, timestamp: NOW },
    nowMs: NOW,
    ...overrides,
  };
}

function withAccuracy(accuracy: number | null) {
  return params({ fix: { latitude: -31, longitude: -60, accuracy, timestamp: NOW } });
}

describe('getGpsSignalLevel', () => {
  it('umbral verde: ≤ 3 m es buena (incluye el límite exacto)', () => {
    expect(getGpsSignalLevel(withAccuracy(0.5))).toBe('buena');
    expect(getGpsSignalLevel(withAccuracy(GPS_ACCURACY_GOOD_MAX_METERS))).toBe('buena');
  });

  it('umbral amarillo: entre 3 y 8 m es regular (incluye el límite exacto)', () => {
    expect(getGpsSignalLevel(withAccuracy(GPS_ACCURACY_GOOD_MAX_METERS + 0.1))).toBe('regular');
    expect(getGpsSignalLevel(withAccuracy(GPS_ACCURACY_REGULAR_MAX_METERS))).toBe('regular');
  });

  it('umbral rojo: > 8 m es mala', () => {
    expect(getGpsSignalLevel(withAccuracy(GPS_ACCURACY_REGULAR_MAX_METERS + 0.1))).toBe('mala');
    expect(getGpsSignalLevel(withAccuracy(50))).toBe('mala');
  });

  it('sin permiso es sin-senal aunque haya fix', () => {
    expect(getGpsSignalLevel(params({ permissionStatus: 'denegado' }))).toBe('sin-senal');
    expect(getGpsSignalLevel(params({ permissionStatus: 'pendiente' }))).toBe('sin-senal');
  });

  it('GPS del dispositivo apagado es sin-senal', () => {
    expect(getGpsSignalLevel(params({ servicesEnabled: false }))).toBe('sin-senal');
  });

  it('sin fix aún es sin-senal', () => {
    expect(getGpsSignalLevel(params({ fix: null }))).toBe('sin-senal');
  });

  it('accuracy no reportada por el provider (null) es sin-senal', () => {
    expect(getGpsSignalLevel(withAccuracy(null))).toBe('sin-senal');
  });

  it('fix viejo (señal perdida) degrada a sin-senal; en el límite exacto sigue vigente', () => {
    const staleFix = { latitude: -31, longitude: -60, accuracy: 2, timestamp: NOW - GPS_FIX_STALE_MS - 1 };
    const limitFix = { latitude: -31, longitude: -60, accuracy: 2, timestamp: NOW - GPS_FIX_STALE_MS };
    expect(getGpsSignalLevel(params({ fix: staleFix }))).toBe('sin-senal');
    expect(getGpsSignalLevel(params({ fix: limitFix }))).toBe('buena');
  });
});
