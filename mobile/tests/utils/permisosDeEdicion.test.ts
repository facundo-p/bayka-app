import { getTreeEditGating, getGroupGating, plantacionEsEditable } from '../../src/utils/permisosDeEdicion';
import { esArchivada, esEliminadaEnServidor } from '../../src/constants/estados';

const ACTIVA = { estado: 'activa', archivadaEn: null, eliminadaEnServidorEn: null };
const FINALIZADA = { estado: 'finalizada', archivadaEn: null, eliminadaEnServidorEn: null };
const ARCHIVADA_EN = '2026-09-17T12:00:00+00:00';
const ACTIVA_ARCHIVADA = { estado: 'activa', archivadaEn: ARCHIVADA_EN, eliminadaEnServidorEn: null };
const FINALIZADA_ARCHIVADA = { estado: 'finalizada', archivadaEn: ARCHIVADA_EN, eliminadaEnServidorEn: null };

const SIN_PERMISOS_DE_GRUPO = { canEdit: false, canDelete: false, canReactivate: false };

describe('getTreeEditGating', () => {
  test('grupo activo + plantación activa + creador → editar y eliminar', () => {
    expect(getTreeEditGating({ plantacion: ACTIVA, subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: true });
  });

  test('grupo finalizado + plantación activa + creador → editar, sin eliminar', () => {
    expect(getTreeEditGating({ plantacion: ACTIVA, subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: false });
  });

  test('grupo sincronizado + plantación activa + creador → editar, sin eliminar', () => {
    expect(getTreeEditGating({ plantacion: ACTIVA, subgroupEstado: 'sincronizada', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: false });
  });

  test('plantación finalizada → sólo lectura (aunque grupo activo y creador)', () => {
    expect(getTreeEditGating({ plantacion: FINALIZADA, subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false });
  });

  test('plantación activa archivada → sólo lectura (#477)', () => {
    expect(getTreeEditGating({ plantacion: ACTIVA_ARCHIVADA, subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false });
  });

  test('no-creador → sólo lectura', () => {
    expect(getTreeEditGating({ plantacion: ACTIVA, subgroupEstado: 'activa', isCreator: false }))
      .toEqual({ canEdit: false, canDelete: false });
  });
});

describe('getGroupGating', () => {
  test('grupo activo + plantación activa + creador → editar y eliminar, sin reactivar', () => {
    expect(getGroupGating({ plantacion: ACTIVA, subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: true, canReactivate: false });
  });

  test('grupo finalizado + plantación activa + creador → solo reactivar', () => {
    expect(getGroupGating({ plantacion: ACTIVA, subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false, canReactivate: true });
  });

  test('plantación finalizada + grupo activo + creador → nada (#469)', () => {
    expect(getGroupGating({ plantacion: FINALIZADA, subgroupEstado: 'activa', isCreator: true }))
      .toEqual(SIN_PERMISOS_DE_GRUPO);
  });

  // El camino de dos pasos que motivó #469: reactivar volvía el grupo a 'activa'
  // y con eso reaparecía el tacho de borrar dentro de una plantación finalizada.
  test('plantación finalizada + grupo finalizado + creador → no se puede reactivar', () => {
    expect(getGroupGating({ plantacion: FINALIZADA, subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual(SIN_PERMISOS_DE_GRUPO);
  });

  test('plantación activa archivada → nada, ni reactivar (#477)', () => {
    expect(getGroupGating({ plantacion: ACTIVA_ARCHIVADA, subgroupEstado: 'activa', isCreator: true }))
      .toEqual(SIN_PERMISOS_DE_GRUPO);
    expect(getGroupGating({ plantacion: ACTIVA_ARCHIVADA, subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual(SIN_PERMISOS_DE_GRUPO);
  });

  test('no-creador sobre grupo activo → nada', () => {
    expect(getGroupGating({ plantacion: ACTIVA, subgroupEstado: 'activa', isCreator: false }))
      .toEqual(SIN_PERMISOS_DE_GRUPO);
  });

  test('grupo sincronizado → ni editar ni reactivar (no es "finalizada")', () => {
    expect(getGroupGating({ plantacion: ACTIVA, subgroupEstado: 'sincronizada', isCreator: true }))
      .toEqual(SIN_PERMISOS_DE_GRUPO);
  });
});

describe('plantacionEsEditable', () => {
  test('activa → editable', () => {
    expect(plantacionEsEditable(ACTIVA)).toBe(true);
  });

  test('finalizada → inmutable', () => {
    expect(plantacionEsEditable(FINALIZADA)).toBe(false);
  });

  // No hay excepción por rol: la función no recibe el rol, así que el superadmin
  // tampoco edita una archivada (#477).
  test('activa + archivada → inmutable', () => {
    expect(plantacionEsEditable(ACTIVA_ARCHIVADA)).toBe(false);
  });

  test('finalizada + archivada → inmutable', () => {
    expect(plantacionEsEditable(FINALIZADA_ARCHIVADA)).toBe(false);
  });
});

describe('esArchivada', () => {
  test('archivada_en null → no archivada', () => {
    expect(esArchivada(ACTIVA)).toBe(false);
  });

  test('con fecha → archivada, sin importar el estado', () => {
    expect(esArchivada(ACTIVA_ARCHIVADA)).toBe(true);
    expect(esArchivada(FINALIZADA_ARCHIVADA)).toBe(true);
  });
});

describe('eliminada en el servidor (#478)', () => {
  const ACTIVA_ELIMINADA = { ...ACTIVA, eliminadaEnServidorEn: '2026-09-17T12:00:00.000Z' };

  test('activa + eliminada → inmutable', () => {
    expect(plantacionEsEditable(ACTIVA_ELIMINADA)).toBe(false);
  });

  test('el creador tampoco edita ni borra árboles ni grupos', () => {
    expect(getTreeEditGating({ plantacion: ACTIVA_ELIMINADA, subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false });
    expect(getGroupGating({ plantacion: ACTIVA_ELIMINADA, subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual(SIN_PERMISOS_DE_GRUPO);
  });

  test('esEliminadaEnServidor mira solo la marca, no el estado', () => {
    expect(esEliminadaEnServidor(ACTIVA)).toBe(false);
    expect(esEliminadaEnServidor(ACTIVA_ELIMINADA)).toBe(true);
  });
});
