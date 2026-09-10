import { filtrarOpciones, type OpcionConDetalle } from '../opcionesConDetalle';
import { OPCIONES } from './fixtures';

const valores = (opciones: OpcionConDetalle[]) => opciones.map((opcion) => opcion.valor);

test('búsqueda vacía devuelve todas', () => {
  expect(filtrarOpciones(OPCIONES, '')).toEqual(OPCIONES);
});

test('filtra por el texto principal o por el secundario', () => {
  expect(valores(filtrarOpciones(OPCIONES, 'ferreyra'))).toEqual(['u4', 'u7']);
  expect(valores(filtrarOpciones(OPCIONES, 'gmail'))).toEqual(['u7']);
});

test('sin coincidencias devuelve lista vacía', () => {
  expect(filtrarOpciones(OPCIONES, 'zzz')).toEqual([]);
});
