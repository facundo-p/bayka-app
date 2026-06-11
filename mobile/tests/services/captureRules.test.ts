// Tests de la lógica pura de captura GPS (regla determinística + frescura de fix).

import {
  GPS_CAPTURE_FREQUENCY_DEFAULT,
  GPS_FIX_MAX_AGE_MS,
} from '../../src/constants/gpsCapture';
import { isFixFresh, shouldCaptureGps } from '../../src/services/gps/captureRules';
import type { GpsFix } from '../../src/services/gps/locationClient';

describe('shouldCaptureGps', () => {
  it('con N=1 captura todas las posiciones', () => {
    for (let pos = 1; pos <= 5; pos++) {
      expect(shouldCaptureGps(pos, 1)).toBe(true);
    }
  });

  it('con N=2 captura las posiciones impares', () => {
    expect(shouldCaptureGps(1, 2)).toBe(true);
    expect(shouldCaptureGps(2, 2)).toBe(false);
    expect(shouldCaptureGps(3, 2)).toBe(true);
    expect(shouldCaptureGps(4, 2)).toBe(false);
  });

  it('con N=10 captura 1, 11, 21 y no las intermedias', () => {
    expect(shouldCaptureGps(1, 10)).toBe(true);
    expect(shouldCaptureGps(2, 10)).toBe(false);
    expect(shouldCaptureGps(10, 10)).toBe(false);
    expect(shouldCaptureGps(11, 10)).toBe(true);
    expect(shouldCaptureGps(12, 10)).toBe(false);
    expect(shouldCaptureGps(21, 10)).toBe(true);
  });

  it('siempre captura el árbol 1 (ancla de cada grupo) para cualquier N', () => {
    for (const n of [1, 2, 3, 7, 10, 50]) {
      expect(shouldCaptureGps(1, n)).toBe(true);
    }
  });

  it('frecuencia inválida (0, negativa, no entera) degrada al default', () => {
    // Con el default 10, la posición 2 no captura y la 11 sí.
    for (const invalid of [0, -3, 2.5, NaN]) {
      expect(shouldCaptureGps(1, invalid)).toBe(true);
      expect(shouldCaptureGps(2, invalid)).toBe(false);
      expect(shouldCaptureGps(GPS_CAPTURE_FREQUENCY_DEFAULT + 1, invalid)).toBe(true);
    }
  });
});

describe('isFixFresh', () => {
  const TAP_AT = 1_700_000_010_000;

  function fixWithAge(ageMs: number): GpsFix {
    return { latitude: -31, longitude: -60, accuracy: 3, timestamp: TAP_AT - ageMs };
  }

  it('null nunca es fresco', () => {
    expect(isFixFresh(null, TAP_AT)).toBe(false);
  });

  it('fix dentro de la edad máxima es fresco (incluye el límite exacto)', () => {
    expect(isFixFresh(fixWithAge(0), TAP_AT)).toBe(true);
    expect(isFixFresh(fixWithAge(GPS_FIX_MAX_AGE_MS), TAP_AT)).toBe(true);
  });

  it('fix más viejo que la edad máxima NO es fresco', () => {
    expect(isFixFresh(fixWithAge(GPS_FIX_MAX_AGE_MS + 1), TAP_AT)).toBe(false);
  });
});
