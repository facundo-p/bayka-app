import {
  claveDeConflicto, eleccionDeConflicto, eleccionesAGuardar, entidadPresente, plantacionesConConflictos,
  puntoCompleto, valorReaplicable,
} from '../../src/utils/conflictosDeSync';
import { cambiosPorResolverDe } from '../../src/utils/conflictosDeEdicion';

const PUNTO = { latitude: -34.3, longitude: -58.3, gpsAccuracy: null, gpsCapturedAt: '2026-10-08T10:40:00' };

describe('valorReaplicable', () => {
  it('el GPS necesita latitud, longitud y momento; la precisión es opcional', () => {
    expect(puntoCompleto(PUNTO)).toBe(true);
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
    expect(entidadPresente({ conflicto: { campo: 'nombre' }, arbol: null, grupo: {} })).toBe(true);
    expect(entidadPresente({ conflicto: { campo: 'gps' }, arbol: null, grupo: {} })).toBe(false);
  });
});

describe('elección', () => {
  const conflicto = { entidadId: 't1', campo: 'gps' as const, detectadoEn: '2026-10-08T10:00:00' };

  it('arranca lo propio; con motivo, siempre lo del servidor', () => {
    expect(eleccionDeConflicto(undefined, null)).toBe('mio');
    expect(eleccionDeConflicto('web', null)).toBe('web');
    expect(eleccionDeConflicto('mio', 'plantacion_no_editable')).toBe('web');
  });

  it('si el servidor vuelve a cambiar el dato, la clave cambia y la elección vuelve a empezar', () => {
    const elegidas = { [claveDeConflicto(conflicto)]: 'web' as const };
    const reemplazado = { ...conflicto, detectadoEn: '2026-10-08T11:00:00' };

    expect(eleccionesAGuardar([{ conflicto, motivo: null }], elegidas)[0].conservar).toBe(false);
    expect(eleccionesAGuardar([{ conflicto: reemplazado, motivo: null }], elegidas)[0].conservar).toBe(true);
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
