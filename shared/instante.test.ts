import { microsegundosDesdeEpoch } from './instante';

const MEDIODIA_UTC = Date.UTC(2026, 2, 1, 12, 0, 0) * 1000;

describe('microsegundosDesdeEpoch', () => {
  it.each([
    '2026-03-01T12:00:00Z',
    '2026-03-01T12:00:00.000Z',
    '2026-03-01T12:00:00+00:00',
    '2026-03-01T09:00:00-03:00',
    '2026-03-01T09:00:00-0300',
    '2026-03-01 12:00:00+00',
    '2026-03-01T12:00:00',
    '2026-03-01T12:00',
  ])('%s es el mediodía UTC', (iso) => {
    expect(microsegundosDesdeEpoch(iso)).toBe(MEDIODIA_UTC);
  });

  it('conserva los microsegundos de Postgres', () => {
    expect(microsegundosDesdeEpoch('2026-03-01T12:00:00.123456+00:00')).toBe(MEDIODIA_UTC + 123456);
  });

  it('completa una fracción corta y corta la de más de seis dígitos', () => {
    expect(microsegundosDesdeEpoch('2026-03-01T12:00:00.5Z')).toBe(MEDIODIA_UTC + 500000);
    expect(microsegundosDesdeEpoch('2026-03-01T12:00:00.1234567Z')).toBe(MEDIODIA_UTC + 123456);
  });

  it.each(['', 'no es fecha', '2026-03-01', '01/03/2026 12:00'])('%j no es un timestamp', (iso) => {
    expect(microsegundosDesdeEpoch(iso)).toBeNull();
  });
});
