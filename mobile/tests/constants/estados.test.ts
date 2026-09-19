import { esActiva, esFinalizada, esArchivada } from '../../src/constants/estados';

describe('predicados de estado de plantación', () => {
  test('esActiva solo reconoce activa', () => {
    expect(esActiva({ estado: 'activa' })).toBe(true);
    expect(esActiva({ estado: 'finalizada' })).toBe(false);
    expect(esActiva({ estado: 'sincronizada' })).toBe(false);
    expect(esActiva({ estado: undefined })).toBe(false);
  });

  test('esFinalizada solo reconoce finalizada', () => {
    expect(esFinalizada({ estado: 'finalizada' })).toBe(true);
    expect(esFinalizada({ estado: 'activa' })).toBe(false);
    expect(esFinalizada({ estado: 'sincronizada' })).toBe(false);
    expect(esFinalizada({ estado: undefined })).toBe(false);
  });

  test('archivar no cambia el estado', () => {
    const finalizadaArchivada = { estado: 'finalizada', archivadaEn: '2026-09-17T12:00:00+00:00' };
    expect(esFinalizada(finalizadaArchivada)).toBe(true);
    expect(esArchivada(finalizadaArchivada)).toBe(true);
  });
});
