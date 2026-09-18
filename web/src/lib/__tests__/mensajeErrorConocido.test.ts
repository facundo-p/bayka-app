import { mensajeErrorConocido } from '../mensajeErrorConocido';

const CONOCIDO = 'El usuario ya está asignado';
const ACCION = 'asignar el usuario';

test('sin error no hay mensaje', () => {
  expect(mensajeErrorConocido(null, CONOCIDO, ACCION)).toBeNull();
});

test('el mensaje conocido se muestra tal cual', () => {
  expect(mensajeErrorConocido(new Error(CONOCIDO), CONOCIDO, ACCION)).toBe(CONOCIDO);
});

test('cualquier otro error se clasifica según su causa', () => {
  expect(mensajeErrorConocido(new Error('TypeError: Failed to fetch'), CONOCIDO, ACCION)).toBe(
    'No se pudo asignar el usuario. Revisá tu conexión y probá de nuevo.',
  );
  expect(mensajeErrorConocido(new Error('duplicate key'), CONOCIDO, ACCION)).toBe(
    'No se pudo asignar el usuario: el servidor rechazó el cambio (duplicate key).',
  );
});
