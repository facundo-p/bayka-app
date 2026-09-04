import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import { ROL } from '../../../repositories/profileRepository';
import { ADVERTENCIA_SUPERADMIN, ETIQUETA_ROL, nombreVisible, ROLES } from '../presentacion';

function usuario(sobreescritura: Partial<UsuarioConAsignaciones>): UsuarioConAsignaciones {
  return {
    id: 'abcdefgh-1234',
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

test('ADVERTENCIA_SUPERADMIN describe el alcance del rol', () => {
  expect(ADVERTENCIA_SUPERADMIN).toBe(
    'Va a tener acceso total, incluida la gestión de usuarios.',
  );
});

test('ROLES lista los tres roles con su etiqueta legible', () => {
  expect(ROLES).toEqual([
    { valor: ROL.TECNICO, etiqueta: 'Técnico' },
    { valor: ROL.ADMIN, etiqueta: 'Admin' },
    { valor: ROL.SUPERADMIN, etiqueta: 'Superadmin' },
  ]);
});

test('ETIQUETA_ROL mapea cada valor de rol a su etiqueta', () => {
  expect(ETIQUETA_ROL).toEqual({
    [ROL.SUPERADMIN]: 'Superadmin',
    [ROL.ADMIN]: 'Admin',
    [ROL.TECNICO]: 'Técnico',
  });
});

test('nombreVisible devuelve el nombre cuando existe', () => {
  expect(nombreVisible(usuario({ nombre: 'Ana' }))).toBe('Ana');
});

test('nombreVisible cae al id corto cuando no hay nombre', () => {
  expect(nombreVisible(usuario({ nombre: '', id: 'abcdefgh-1234' }))).toBe('abcdefgh');
});
