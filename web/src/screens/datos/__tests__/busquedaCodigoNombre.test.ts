import { filtrarPorCodigoNombre } from '../busquedaCodigoNombre';

const FILAS = [
  { id: 'g1', codigo: 'L1', nombre: 'Línea 1' },
  { id: 'g2', codigo: 'L2', nombre: 'Loma alta' },
  { id: 'g3', codigo: 'P9', nombre: 'Bajo' },
];

function ids(busqueda: string) {
  return filtrarPorCodigoNombre(FILAS, busqueda)?.map((fila) => fila.id);
}

test('filtra por código o nombre sin distinguir mayúsculas ni tildes', () => {
  expect(ids('l1')).toEqual(['g1']);
  expect(ids('linea')).toEqual(['g1']);
  expect(ids('LOMA')).toEqual(['g2']);
});

test('sin búsqueda deja todas las filas', () => {
  expect(ids('')).toEqual(['g1', 'g2', 'g3']);
  expect(ids('  ')).toEqual(['g1', 'g2', 'g3']);
});

test('mientras las filas cargan devuelve undefined', () => {
  expect(filtrarPorCodigoNombre(undefined, 'l1')).toBeUndefined();
});
