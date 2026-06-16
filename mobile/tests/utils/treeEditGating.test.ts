import { getTreeEditGating } from '../../src/utils/treeEditGating';

describe('getTreeEditGating (#155)', () => {
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
