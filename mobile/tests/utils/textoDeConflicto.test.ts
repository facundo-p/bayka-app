import { origenDelCambioWeb, textoAnterior, textoDeValor } from '../../src/utils/textoDeConflicto';
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
});
