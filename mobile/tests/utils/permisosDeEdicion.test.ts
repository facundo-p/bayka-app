import { getTreeEditGating, getGroupGating, plantacionEsEditable } from '../../src/utils/permisosDeEdicion';

describe('getTreeEditGating', () => {
  test('grupo activo + plantación activa + creador → editar y eliminar', () => {
    expect(getTreeEditGating({ plantacionEstado: 'activa', subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: true });
  });

  test('grupo finalizado + plantación activa + creador → editar, sin eliminar', () => {
    expect(getTreeEditGating({ plantacionEstado: 'activa', subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: false });
  });

  test('grupo sincronizado + plantación activa + creador → editar, sin eliminar', () => {
    expect(getTreeEditGating({ plantacionEstado: 'activa', subgroupEstado: 'sincronizada', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: false });
  });

  test('plantación finalizada → sólo lectura (aunque grupo activo y creador)', () => {
    expect(getTreeEditGating({ plantacionEstado: 'finalizada', subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false });
  });

  test('no-creador → sólo lectura', () => {
    expect(getTreeEditGating({ plantacionEstado: 'activa', subgroupEstado: 'activa', isCreator: false }))
      .toEqual({ canEdit: false, canDelete: false });
  });
});

describe('getGroupGating', () => {
  test('grupo activo + plantación activa + creador → editar y eliminar, sin reactivar', () => {
    expect(getGroupGating({ plantacionEstado: 'activa', subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: true, canDelete: true, canReactivate: false });
  });

  test('grupo finalizado + plantación activa + creador → solo reactivar', () => {
    expect(getGroupGating({ plantacionEstado: 'activa', subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false, canReactivate: true });
  });

  test('plantación finalizada + grupo activo + creador → nada (#469)', () => {
    expect(getGroupGating({ plantacionEstado: 'finalizada', subgroupEstado: 'activa', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false, canReactivate: false });
  });

  // El camino de dos pasos que motivó #469: reactivar volvía el grupo a 'activa'
  // y con eso reaparecía el tacho de borrar dentro de una plantación finalizada.
  test('plantación finalizada + grupo finalizado + creador → no se puede reactivar', () => {
    expect(getGroupGating({ plantacionEstado: 'finalizada', subgroupEstado: 'finalizada', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false, canReactivate: false });
  });

  test('no-creador sobre grupo activo → nada', () => {
    expect(getGroupGating({ plantacionEstado: 'activa', subgroupEstado: 'activa', isCreator: false }))
      .toEqual({ canEdit: false, canDelete: false, canReactivate: false });
  });

  test('grupo sincronizado → ni editar ni reactivar (no es "finalizada")', () => {
    expect(getGroupGating({ plantacionEstado: 'activa', subgroupEstado: 'sincronizada', isCreator: true }))
      .toEqual({ canEdit: false, canDelete: false, canReactivate: false });
  });
});

describe('plantacionEsEditable', () => {
  test('activa → editable', () => {
    expect(plantacionEsEditable('activa')).toBe(true);
  });

  test('finalizada → inmutable', () => {
    expect(plantacionEsEditable('finalizada')).toBe(false);
  });
});
