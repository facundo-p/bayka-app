import {
  conCambiosDeLaPantalla,
  esAltaPendiente,
  mensajeTecnicosNoAsignados,
  tecnicosNoAsignadosDe,
} from '../../src/utils/tecnicosDePlantacion';
import { altasYBajasDeLaSeleccion, sinCambios } from '../../src/utils/altasYBajas';

describe('tecnicosNoAsignadosDe', () => {
  it('una línea por plantación con técnicos rechazados; ignora las demás y los fallos', () => {
    expect(tecnicosNoAsignadosDe([
      { success: true, nombre: 'Campo', tecnicosNoAsignados: ['Ana', 'Bruno'] },
      { success: true, nombre: 'Sur', tecnicosNoAsignados: [] },
      { success: true, nombre: 'Norte' },
      { success: false, nombre: 'Este', tecnicosNoAsignados: ['Carla'] },
    ])).toEqual(['Campo: Ana, Bruno']);
  });
});

describe('mensajeTecnicosNoAsignados', () => {
  it('nombra a los técnicos y dice por qué', () => {
    expect(mensajeTecnicosNoAsignados(['Ana', 'Bruno'])).toBe(
      'No se pudo asignar a Ana, Bruno. Están dados de baja, ya no son técnicos o no pertenecen a la organización, así que se quitaron de la plantación.',
    );
  });
});

describe('esAltaPendiente', () => {
  it('solo si está asignado y sin subir', () => {
    expect(esAltaPendiente({ assigned: true, pendiente: true })).toBe(true);
    expect(esAltaPendiente({ assigned: false, pendiente: true })).toBe(false);
    expect(esAltaPendiente({ assigned: true, pendiente: false })).toBe(false);
  });
});

describe('altasYBajasDeLaSeleccion', () => {
  const id = (t: { id: string }) => t.id;
  const marcado = (t: { on: boolean }) => t.on;

  it('solo lo que cambió; lo que no estaba al abrir no se toca', () => {
    const iniciales = [{ id: 'a', on: true }, { id: 'b', on: false }, { id: 'c', on: true }];
    const actuales = [{ id: 'a', on: false }, { id: 'b', on: true }, { id: 'c', on: true }, { id: 'z', on: true }];

    expect(altasYBajasDeLaSeleccion(iniciales, actuales, id, marcado)).toEqual({ altas: ['b'], bajas: ['a'] });
  });

  it('sinCambios', () => {
    expect(sinCambios({ altas: [], bajas: [] })).toBe(true);
    expect(sinCambios({ altas: ['a'], bajas: [] })).toBe(false);
  });
});

describe('conCambiosDeLaPantalla', () => {
  const t = (id: string, assigned: boolean) => ({ id, assigned, pendiente: false });

  it('la lista nueva con las altas y bajas que el usuario ya hizo', () => {
    const iniciales = [t('a', true), t('b', false)];
    const items = [t('a', false), t('b', true)];
    const nuevos = [t('a', true), t('b', false), t('c', true)];

    expect(conCambiosDeLaPantalla(nuevos, { iniciales, items })).toEqual([t('a', false), t('b', true), t('c', true)]);
  });
});
