import {
  claveDeConflicto, eleccionDeConflicto, eleccionesAGuardar, entidadPresente, plantacionesConConflictos,
  puntoCompleto, tieneCoordenadas, valorReaplicable,
} from '../../src/utils/conflictosDeSync';
import { cambiosPorResolverDe } from '../../src/utils/conflictosDeEdicion';
import type { CampoEnConflicto } from '../../src/constants/conflictoDeSync';
import type { ConflictoParaResolver, GrupoEnConflicto } from '../../src/types/conflictoDeSync';

const GRUPO: GrupoEnConflicto = { id: 'g1', parcelaId: 'pa1', codigo: 'A', nombre: 'Alfa', tipo: 'bosquete', estado: 'activa' };

const conflictoDe = (campo: CampoEnConflicto, detectadoEn = '2026-10-08T10:00:00'): ConflictoParaResolver => ({
  conflicto: { entidadId: 't1', campo, grupoId: 'g1', plantacionId: 'p1', mio: null, servidor: null, detectadoEn },
  arbol: null,
  grupo: GRUPO,
  especies: { mia: null, servidor: null },
  motivo: null,
});

const PUNTO = { latitude: -34.3, longitude: -58.3, gpsAccuracy: null, gpsCapturedAt: '2026-10-08T10:40:00' };

describe('valorReaplicable', () => {
  it('el GPS necesita latitud, longitud y momento; la precisión es opcional', () => {
    expect(puntoCompleto(PUNTO)).toBe(true);
    expect(tieneCoordenadas({ ...PUNTO, gpsCapturedAt: null })).toBe(true);
    expect(valorReaplicable('gps', { ...PUNTO, gpsCapturedAt: null })).toBe(false);
    expect(valorReaplicable('gps', null)).toBe(false);
  });

  it('estado y tipo, solo los conocidos; nombre, código y foto, texto no vacío', () => {
    expect(valorReaplicable('estado', 'finalizada')).toBe(true);
    expect(valorReaplicable('estado', 'sincronizada')).toBe(false);
    expect(valorReaplicable('tipo', 'bosquete')).toBe(true);
    expect(valorReaplicable('tipo', 'otro')).toBe(false);
    expect(valorReaplicable('nombre', '')).toBe(false);
    expect(valorReaplicable('foto', 'file:///mia.jpg')).toBe(true);
  });
});

describe('entidadPresente', () => {
  it('los de grupo miran el grupo; los de árbol, el árbol', () => {
    expect(entidadPresente(conflictoDe('nombre'))).toBe(true);
    expect(entidadPresente(conflictoDe('gps'))).toBe(false);
  });
});

describe('elección', () => {
  const visto = conflictoDe('gps');

  it('arranca lo propio; con motivo, siempre lo del servidor', () => {
    expect(eleccionDeConflicto(undefined, null)).toBe('mio');
    expect(eleccionDeConflicto('web', null)).toBe('web');
    expect(eleccionDeConflicto('mio', 'plantacion_no_editable')).toBe('web');
  });

  it('si el servidor vuelve a cambiar el dato, la clave cambia y la elección vuelve a empezar', () => {
    const elegidas = { [claveDeConflicto(visto.conflicto)]: 'web' as const };
    const reemplazado = conflictoDe('gps', '2026-10-08T11:00:00');

    expect(eleccionesAGuardar([visto], elegidas)[0]).toMatchObject({ conservar: false, detectadoEn: '2026-10-08T10:00:00' });
    expect(eleccionesAGuardar([reemplazado], elegidas)[0]).toMatchObject({ conservar: true, detectadoEn: '2026-10-08T11:00:00' });
  });
});

describe('aviso del resultado de la sync', () => {
  const plantaciones = [{ id: 'p1', lugar: 'Lote Norte' }, { id: 'p2', lugar: 'Campo Sur' }];
  const porPlantacion = new Map([['p1', 2], ['p2', 1]]);

  it('en la sync global, todas las que tienen conflictos; en la de una, solo esa', () => {
    expect(plantacionesConConflictos(porPlantacion, plantaciones, null)).toHaveLength(2);
    expect(plantacionesConConflictos(porPlantacion, plantaciones, 'p2'))
      .toEqual([{ plantacionId: 'p2', nombre: 'Campo Sur', cantidad: 1 }]);
  });

  it('suma los cambios de la edición y los conflictos de sync de la misma plantación', () => {
    const resultados = [{ success: true, plantacionId: 'p1', nombre: 'Lote Norte', cambiosPorResolver: 1 }];

    expect(cambiosPorResolverDe(resultados, plantacionesConConflictos(porPlantacion, plantaciones, null))).toEqual([
      { plantacionId: 'p1', nombre: 'Lote Norte', cantidad: 3 },
      { plantacionId: 'p2', nombre: 'Campo Sur', cantidad: 1 },
    ]);
  });
});
