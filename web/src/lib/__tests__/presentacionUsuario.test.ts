import { etiquetaRol, nombreVisible } from '../presentacionUsuario';

const ID = 'abcdefgh-1234-5678';

test('etiquetaRol: los tres roles con su etiqueta en español', () => {
  expect(etiquetaRol('superadmin')).toBe('Superadmin');
  expect(etiquetaRol('admin')).toBe('Administrador');
  expect(etiquetaRol('tecnico')).toBe('Técnico');
});

test('nombreVisible devuelve el nombre sin los espacios de los bordes', () => {
  expect(nombreVisible('  Ana Pérez ', ID)).toBe('Ana Pérez');
});

test('nombreVisible cae a los 8 primeros caracteres del id con el nombre vacío', () => {
  expect(nombreVisible('', ID)).toBe('abcdefgh');
});

test('nombreVisible trata un nombre de solo espacios como vacío', () => {
  expect(nombreVisible('   ', ID)).toBe('abcdefgh');
});

test('nombreVisible cae al id corto sin nombre', () => {
  expect(nombreVisible(null, ID)).toBe('abcdefgh');
});
