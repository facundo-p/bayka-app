import { origenDelCambioWeb, parsearTimestamp, textoAnterior, textoDeMomento, textoDeValor } from '../../src/utils/textoDeConflicto';
import type { ConflictoDeCampo } from '../../src/utils/conflictosDeEdicion';

describe('textos de Resolver cambios', () => {
  it('muestra cada valor como lo carga el usuario', () => {
    expect(textoDeValor('objetivoArboles', 12500)).toBe('12.500');
    expect(textoDeValor('fechaInicio', '2026-04-15')).toBe('15/04/2026');
    expect(textoDeValor('visibleInApp', false)).toBe('No');
    expect(textoDeValor('descripcion', null)).toBe('Sin dato');
  });

  it('dice quién cambió en la web si se sabe, y el valor anterior', () => {
    const conflicto: ConflictoDeCampo = {
      campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000,
      editadoPor: 'Ana', editadoEn: null, mioEn: null,
    };
    expect(origenDelCambioWeb(conflicto)).toBe('En la web · Ana');
    expect(origenDelCambioWeb({ ...conflicto, editadoPor: null })).toBe('En la web');
    expect(textoAnterior(conflicto)).toBe('Antes de los dos cambios: 12.000');
  });

  it('parsea timestamps de Postgres con microsegundos y offset', () => {
    expect(parsearTimestamp('2026-09-24T13:12:05.123456+00:00')?.toISOString()).toBe('2026-09-24T13:12:05.123Z');
    expect(parsearTimestamp('2026-09-24T10:12:00-03:00')?.toISOString()).toBe('2026-09-24T13:12:00.000Z');
    expect(parsearTimestamp('2026-09-24T13:12:00Z')?.toISOString()).toBe('2026-09-24T13:12:00.000Z');
    expect(parsearTimestamp('no es fecha')).toBeNull();
  });

  it('dice hoy, ayer o la fecha, en la hora local', () => {
    const local = (d: number, h: number, m: number) => new Date(2026, 8, d, h, m);
    const ahora = local(24, 18, 0);
    const iso = (d: Date) => d.toISOString();
    expect(textoDeMomento(iso(local(24, 10, 12)), ahora)).toBe('hoy 10:12');
    expect(textoDeMomento(iso(local(23, 17, 40)), ahora)).toBe('ayer 17:40');
    expect(textoDeMomento(iso(local(20, 9, 5)), ahora)).toBe('20/09 09:05');
    expect(textoDeMomento(null, ahora)).toBeNull();
  });
});
