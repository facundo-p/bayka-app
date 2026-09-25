// Fechas de calendario (#646): YYYY-MM-DD ↔ Date sin corrimiento de zona horaria.

import { dateAIso, isoADate, isoAFecha, recortarIso } from '../../src/utils/fechaDeCalendario';

const TZ_ORIGINAL = process.env.TZ;

describe('en Argentina (UTC-3), donde toISOString corre el día', () => {
  beforeAll(() => { process.env.TZ = 'America/Argentina/Buenos_Aires'; });
  afterAll(() => { process.env.TZ = TZ_ORIGINAL; });

  it('la zona de prueba está activa', () => {
    expect(new Date(2026, 2, 15).getTimezoneOffset()).toBe(180);
  });

  it('un 15/03 elegido a cualquier hora se guarda como 15/03', () => {
    expect(dateAIso(new Date(2026, 2, 15, 0, 0))).toBe('2026-03-15');
    expect(dateAIso(new Date(2026, 2, 15, 22, 30))).toBe('2026-03-15');
    expect(dateAIso(new Date(2026, 2, 15, 23, 59))).toBe('2026-03-15');
  });

  it('YYYY-MM-DD abre el calendario en ese mismo día', () => {
    const fecha = isoADate('2026-03-15');
    expect([fecha?.getFullYear(), fecha?.getMonth(), fecha?.getDate()]).toEqual([2026, 2, 15]);
  });

  it('ida y vuelta conserva la fecha, también en bordes de mes y año', () => {
    for (const iso of ['2026-03-15', '2026-01-01', '2025-12-31', '2024-02-29']) {
      expect(dateAIso(isoADate(iso)!)).toBe(iso);
    }
  });
});

describe('formato', () => {
  it('muestra la fecha de la base en DD/MM/AAAA', () => {
    expect(isoAFecha('2026-04-15')).toBe('15/04/2026');
    expect(isoAFecha(null)).toBe('');
    expect(isoAFecha('')).toBe('');
  });

  it('recorta un timestamp a su fecha y descarta lo que no es fecha', () => {
    expect(recortarIso('2026-04-15')).toBe('2026-04-15');
    expect(recortarIso('2026-04-15T00:00:00.000Z')).toBe('2026-04-15');
    expect(recortarIso(undefined)).toBe('');
    expect(recortarIso('15/04/2026')).toBe('');
  });

  it('isoADate devuelve null si no es una fecha', () => {
    expect(isoADate('')).toBeNull();
    expect(isoADate('15/04/2026')).toBeNull();
  });
});
