import { formatGpsAccuracy } from '../../src/utils/gpsAccuracyFormat';

describe('formatGpsAccuracy', () => {
  it('redondea los metros', () => {
    expect(formatGpsAccuracy(2.6)).toBe('± 3 m');
    expect(formatGpsAccuracy(13.4)).toBe('± 13 m');
  });

  it('sin precisión informada: "s/d"', () => {
    expect(formatGpsAccuracy(null)).toBe('s/d');
  });
});
