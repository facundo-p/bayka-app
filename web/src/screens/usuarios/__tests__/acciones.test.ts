import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import {
  contarSuperadminsActivos,
  itemsDeMenu,
  motivoCambiarPassword,
  motivoCambiarRol,
  motivoDesactivar,
  motivoReenviarInvitacion,
} from '../acciones';

function usuario(sobreescritura: Partial<UsuarioConAsignaciones>): UsuarioConAsignaciones {
  return {
    id: 'user-x',
    nombre: 'Equis',
    rol: 'tecnico',
    email: 'x@bayka.org',
    activo: true,
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

test('itemsDeMenu ofrece Desactivar a activos y Reactivar a inactivos', () => {
  const acciones = (activo: boolean) =>
    itemsDeMenu(usuario({ activo }), YO, 2).map((item) => item.accion);
  expect(acciones(true)).toEqual(['editar', 'cambiarPassword', 'reenviarInvitacion', 'desactivar']);
  expect(acciones(false)).toEqual(['editar', 'cambiarPassword', 'reenviarInvitacion', 'reactivar']);
});
