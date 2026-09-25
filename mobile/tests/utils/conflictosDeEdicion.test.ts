import {
  aplicados,
  cambiosPorResolverDe,
  combinarConflictos,
  conflictosDesdeRemotos,
  sinElCampo,
  tieneCambiosPorResolver,
  valoresDeLaWeb,
  type ConflictoDeCampo,
} from '../../src/utils/conflictosDeEdicion';

const OBJETIVO: ConflictoDeCampo = {
  campo: 'objetivoArboles', mio: 15000, web: 12500, anterior: 12000,
  editadoPor: 'Ana', editadoEn: '2026-09-24T13:12:00Z', mioEn: '2026-09-23T20:40:00Z',
};

describe('conflictos de edición', () => {
  it('arma cada conflicto con el valor propio, el de la web y el anterior', () => {
    const conflictos = conflictosDesdeRemotos(
      [{ campo: 'objetivo_arboles', valor_servidor: 12500, editado_por: 'Ana', editado_en: '2026-09-24T13:12:00Z' }],
      { cambios: { objetivoArboles: 15000 }, base: { objetivoArboles: 12000 }, mioEn: '2026-09-23T20:40:00Z' },
    );
    expect(conflictos).toEqual([OBJETIVO]);
  });

  it('ignora columnas que no son editables', () => {
    expect(conflictosDesdeRemotos([{ campo: 'estado', valor_servidor: 'x' }], { cambios: {}, base: {}, mioEn: null })).toEqual([]);
  });

  it('lo aplicado es todo menos lo que chocó; mientras tanto queda el valor de la web', () => {
    expect(aplicados({ objetivoArboles: 15000, descripcion: 'Mía' }, [OBJETIVO])).toEqual({ descripcion: 'Mía' });
    expect(valoresDeLaWeb([OBJETIVO])).toEqual({ objetivoArboles: 12500 });
  });

  it('un campo que se volvió a subir deja de estar en conflicto; null si no queda ninguno', () => {
    const descripcion: ConflictoDeCampo = { ...OBJETIVO, campo: 'descripcion', mio: 'a', web: 'b', anterior: null };
    expect(combinarConflictos([OBJETIVO, descripcion], { objetivoArboles: 15000 }, [])).toEqual([descripcion]);
    expect(combinarConflictos([OBJETIVO], { objetivoArboles: 15000 }, [])).toBeNull();
    expect(combinarConflictos(null, {}, [OBJETIVO])).toEqual([OBJETIVO]);
    expect(sinElCampo([OBJETIVO], 'objetivoArboles')).toBeNull();
  });

  it('marca y resumen del sync', () => {
    expect(tieneCambiosPorResolver({ conflictosDeEdicion: [OBJETIVO] })).toBe(true);
    expect(tieneCambiosPorResolver({ conflictosDeEdicion: null })).toBe(false);
    expect(cambiosPorResolverDe([
      { success: true, plantacionId: 'p1', nombre: 'Norte', cambiosPorResolver: 2 },
      { success: true, plantacionId: 'p2', nombre: 'Sur', cambiosPorResolver: 0 },
    ])).toEqual([{ plantacionId: 'p1', nombre: 'Norte', cantidad: 2 }]);
  });
});
