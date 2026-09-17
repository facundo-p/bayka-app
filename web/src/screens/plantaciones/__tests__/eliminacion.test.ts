import type { PreviewEliminacion } from '../../../queries/eliminacionQueries';
import {
  copyArchivarPrimero,
  copyConfirmarNombre,
  copySinDatos,
  copySoloSuperadmin,
  nombreCoincide,
  ofreceArchivar,
  permiteBorrar,
  puedeLimpiarFotos,
  textoConteos,
  textoEliminada,
  textoLimpiezaFotos,
  vistaEliminacion,
} from '../eliminacion';

const PREVIEW: PreviewEliminacion = {
  parcelas: 3,
  grupos: 1,
  arboles: 1234,
  arbolesConFoto: 456,
  tieneDatos: true,
  motivo: null,
};

describe('vistaEliminacion', () => {
  test.each([
    ['sin datos', { tieneDatos: false, motivo: null }, 'sinDatos'],
    ['superadmin, con datos y archivada', { tieneDatos: true, motivo: null }, 'confirmarNombre'],
    ['admin con datos', { tieneDatos: true, motivo: 'REQUIERE_SUPERADMIN' }, 'soloSuperadmin'],
    [
      'superadmin con datos sin archivar',
      { tieneDatos: true, motivo: 'REQUIERE_ARCHIVAR' },
      'archivarPrimero',
    ],
  ] as const)('%s → %s', (_caso, preview, vista) => {
    expect(vistaEliminacion(preview)).toBe(vista);
  });

  test('solo las vistas de borrado permiten borrar', () => {
    expect(permiteBorrar('sinDatos')).toBe(true);
    expect(permiteBorrar('confirmarNombre')).toBe(true);
    expect(permiteBorrar('soloSuperadmin')).toBe(false);
    expect(permiteBorrar('archivarPrimero')).toBe(false);
  });
});

describe('ofreceArchivar', () => {
  test.each([
    ['admin con datos sin archivar', 'soloSuperadmin', false, true],
    ['admin con datos ya archivada', 'soloSuperadmin', true, false],
    ['superadmin sin archivar', 'archivarPrimero', false, true],
    ['una que se puede borrar', 'sinDatos', false, false],
  ] as const)('%s → %s', (_caso, vista, archivada, esperado) => {
    expect(ofreceArchivar(vista, archivada)).toBe(esperado);
  });
});

test('el nombre se compara ignorando espacios de los extremos, con mayúsculas exactas', () => {
  expect(nombreCoincide('  Mendoza ', 'Mendoza')).toBe(true);
  expect(nombreCoincide('mendoza', 'Mendoza')).toBe(false);
  expect(nombreCoincide('', 'Mendoza')).toBe(false);
});

test('los conteos concuerdan y formatean miles', () => {
  expect(textoConteos(PREVIEW)).toBe('3 parcelas, 1 grupo y 1.234 árboles (456 árboles con foto)');
});

describe('textos', () => {
  test('sin datos: avisa que es irreversible', () => {
    expect(copySinDatos('Mendoza')).toMatch(/No se puede deshacer/);
  });

  test('con datos: conteos, irreversibilidad y pérdida de lo no sincronizado', () => {
    const texto = copyConfirmarNombre('Mendoza', PREVIEW);
    expect(texto).toMatch(/1\.234 árboles/);
    expect(texto).toMatch(/No se puede deshacer/);
    expect(texto).toMatch(/sin sincronizar, se pierden/);
  });

  test('admin: explica que solo un superadmin borra y ofrece archivar si no lo está', () => {
    expect(copySoloSuperadmin('Mendoza', false)).toMatch(/solo un superadmin[\s\S]*archivarla/);
    expect(copySoloSuperadmin('Mendoza', true)).toMatch(/Ya está archivada/);
  });

  test('superadmin sin archivar: archivala primero', () => {
    expect(copyArchivarPrimero('Mendoza')).toMatch(/primero archivala/);
  });

  test('el resultado avisa si quedaron fotos', () => {
    expect(textoEliminada(false)).toBe('La plantación se eliminó.');
    expect(textoEliminada(true)).toMatch(/algunas fotos no se pudieron borrar/);
  });
});

describe('limpieza de fotos (#523)', () => {
  test('solo un superadmin activo puede reintentarla', () => {
    expect(puedeLimpiarFotos({ rol: 'superadmin', activo: true })).toBe(true);
    expect(puedeLimpiarFotos({ rol: 'superadmin', activo: false })).toBe(false);
    expect(puedeLimpiarFotos({ rol: 'admin', activo: true })).toBe(false);
    expect(puedeLimpiarFotos(null)).toBe(false);
  });

  test('el texto dice si quedaron fotos', () => {
    expect(textoLimpiezaFotos({ limpiadas: 1, pendientes: 0 })).toBe('No quedan fotos pendientes de borrar.');
    expect(textoLimpiezaFotos({ limpiadas: 0, pendientes: 1 })).toBe(
      'Algunas fotos siguen sin poder borrarse. Probá de nuevo más tarde.',
    );
  });
});
