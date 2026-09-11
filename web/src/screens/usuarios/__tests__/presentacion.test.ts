import { ADVERTENCIA_SUPERADMIN, OPCIONES_ROL } from '../presentacion';

test('ADVERTENCIA_SUPERADMIN describe el alcance del rol', () => {
  expect(ADVERTENCIA_SUPERADMIN).toBe(
    'Va a tener acceso total, incluida la gestión de usuarios.',
  );
});

test('OPCIONES_ROL lista los tres roles de menor a mayor alcance', () => {
  expect(OPCIONES_ROL).toEqual([
    { value: 'tecnico', label: 'Técnico' },
    { value: 'admin', label: 'Administrador' },
    { value: 'superadmin', label: 'Superadmin' },
  ]);
});
