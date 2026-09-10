import { filtrarOpciones, type OpcionConDetalle } from '../opcionesConDetalle';

const OPCIONES: OpcionConDetalle[] = [
  { valor: 'u4', principal: 'Lucía Ferreyra', secundario: 'lucia@bayka.app' },
  { valor: 'u7', principal: 'Lucía Ferreyra', secundario: 'lferreyra@gmail.com' },
  { valor: 'u8', principal: 'Pablo Ríos', secundario: null },
];

const valores = (opciones: OpcionConDetalle[]) => opciones.map((opcion) => opcion.valor);

test('búsqueda vacía o solo espacios devuelve todas', () => {
  expect(filtrarOpciones(OPCIONES, '')).toBe(OPCIONES);
  expect(filtrarOpciones(OPCIONES, '   ')).toBe(OPCIONES);
});

test('filtra por el texto secundario', () => {
  expect(valores(filtrarOpciones(OPCIONES, 'gmail'))).toEqual(['u7']);
});

test('filtra por el principal sin distinguir acentos ni mayúsculas', () => {
  expect(valores(filtrarOpciones(OPCIONES, 'LUCIA'))).toEqual(['u4', 'u7']);
  expect(valores(filtrarOpciones(OPCIONES, 'rios'))).toEqual(['u8']);
});

test('sin coincidencias devuelve lista vacía', () => {
  expect(filtrarOpciones(OPCIONES, 'zzz')).toEqual([]);
});
