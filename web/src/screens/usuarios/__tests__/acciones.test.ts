import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import {
  contarSuperadminsActivos,
  itemsDeMenu,
  motivoCambiarPassword,
  motivoCambiarRol,
  motivoDesactivar,
  motivoEliminar,
  motivoReenviarInvitacion,
} from '../acciones';

function usuario(sobreescritura: Partial<UsuarioConAsignaciones>): UsuarioConAsignaciones {
  return {
    id: 'user-x',
    nombre: 'Equis',
    rol: 'tecnico',
    email: 'x@bayka.org',
    activo: true,
    eliminadoEn: null,
    organizacionId: 'org-1',
    organizacionNombre: 'Bayka',
    plantacionesAsignadas: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...sobreescritura,
  };
}

const YO = 'user-yo';

test('contarSuperadminsActivos ignora superadmins inactivos y otros roles', () => {
  expect(
    contarSuperadminsActivos([
      usuario({ rol: 'superadmin', activo: true }),
      usuario({ rol: 'superadmin', activo: false }),
      usuario({ rol: 'admin', activo: true }),
    ]),
  ).toBe(1);
});

test('motivoCambiarRol: propio, último superadmin activo, resto habilitado', () => {
  expect(motivoCambiarRol(usuario({ id: YO }), YO, 2)).toMatch(/tu propio rol/);
  expect(motivoCambiarRol(usuario({ rol: 'superadmin' }), YO, 1)).toMatch(/Único superadmin/);
  // Un superadmin inactivo sí es editable aunque sea "el único" del conteo.
  expect(motivoCambiarRol(usuario({ rol: 'superadmin', activo: false }), YO, 1)).toBeNull();
  expect(motivoCambiarRol(usuario({}), YO, 1)).toBeNull();
});

test('motivoCambiarPassword: bloquea a OTRO superadmin, permite la propia', () => {
  expect(motivoCambiarPassword(usuario({ rol: 'superadmin' }), YO)).toMatch(
    /contraseña de otro superadmin/,
  );
  expect(motivoCambiarPassword(usuario({ id: YO, rol: 'superadmin' }), YO)).toBeNull();
  expect(motivoCambiarPassword(usuario({ rol: 'admin' }), YO)).toBeNull();
});

test('motivoDesactivar: a sí mismo y último superadmin activo bloqueados', () => {
  expect(motivoDesactivar(usuario({ id: YO }), YO, 2)).toMatch(/desactivarse a sí mismo/);
  expect(motivoDesactivar(usuario({ rol: 'superadmin' }), YO, 1)).toMatch(
    /último superadmin activo/,
  );
  expect(motivoDesactivar(usuario({ rol: 'superadmin' }), YO, 2)).toBeNull();
  expect(motivoDesactivar(usuario({}), YO, 1)).toBeNull();
});

test('motivoReenviarInvitacion exige email registrado', () => {
  expect(motivoReenviarInvitacion(usuario({ email: null }))).toMatch(/no tiene email/);
  expect(motivoReenviarInvitacion(usuario({}))).toBeNull();
});

test('itemsDeMenu ofrece Desactivar a activos y Reactivar a inactivos, y Eliminar a ambos', () => {
  const acciones = (activo: boolean) =>
    itemsDeMenu(usuario({ activo }), YO, 2).map((item) => item.accion);
  // Editar no está: se edita clickeando la fila, que abre el panel lateral.
  expect(acciones(true)).toEqual([
    'cambiarPassword',
    'reenviarInvitacion',
    'desactivar',
    'eliminar',
  ]);
  expect(acciones(false)).toEqual([
    'cambiarPassword',
    'reenviarInvitacion',
    'reactivar',
    'eliminar',
  ]);
});

test('motivoEliminar: mismos guards que desactivar, con su propio texto', () => {
  expect(motivoEliminar(usuario({ id: YO }), YO, 2)).toBe(
    'Un superadmin no puede eliminarse a sí mismo',
  );
  expect(motivoEliminar(usuario({ rol: 'superadmin' }), YO, 1)).toBe(
    'No podés eliminar al último superadmin activo',
  );
  expect(motivoEliminar(usuario({ rol: 'superadmin' }), YO, 2)).toBeNull();
  expect(motivoEliminar(usuario({}), YO, 1)).toBeNull();
});

test('itemsDeMenu: un eliminado no ofrece ninguna acción', () => {
  expect(
    itemsDeMenu(usuario({ activo: false, eliminadoEn: '2026-09-01T00:00:00Z' }), YO, 2),
  ).toEqual([]);
});
