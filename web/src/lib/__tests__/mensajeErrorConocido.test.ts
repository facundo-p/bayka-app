import { mensajeErrorConocido } from '../mensajeErrorConocido';

const CONOCIDO = 'El usuario ya está asignado';
const GENERICO = 'No se pudo asignar el usuario.';

test('sin error no hay mensaje', () => {
  expect(mensajeErrorConocido(null, CONOCIDO, GENERICO)).toBeNull();
});

test('el mensaje conocido se muestra tal cual', () => {
  expect(mensajeErrorConocido(new Error(CONOCIDO), CONOCIDO, GENERICO)).toBe(CONOCIDO);
});

test('cualquier otro error cae al genérico', () => {
  expect(mensajeErrorConocido(new Error('duplicate key'), CONOCIDO, GENERICO)).toBe(GENERICO);
});
