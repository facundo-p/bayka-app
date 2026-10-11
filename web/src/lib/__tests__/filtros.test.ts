import { contarFiltrosActivos, limpiarFiltros } from '../filtros';

const INICIALES = { estado: 'todas', temporada: '', orden: 'arboles', busqueda: '' };

test('sin cambios respecto de los iniciales no hay ninguno activo', () => {
  expect(contarFiltrosActivos(INICIALES, INICIALES)).toBe(0);
  expect(contarFiltrosActivos({ ...INICIALES }, INICIALES)).toBe(0);
});

test('cuenta uno por cada filtro que se apartó de su valor inicial', () => {
  expect(contarFiltrosActivos({ ...INICIALES, estado: 'activas' }, INICIALES)).toBe(1);
  expect(
    contarFiltrosActivos({ ...INICIALES, estado: 'activas', temporada: '2025' }, INICIALES),
  ).toBe(2);
});

test('el orden y la búsqueda no cuentan: quedan a la vista, fuera del panel', () => {
  expect(contarFiltrosActivos({ ...INICIALES, orden: 'creada' }, INICIALES)).toBe(0);
  expect(contarFiltrosActivos({ ...INICIALES, busqueda: 'algarrobo' }, INICIALES)).toBe(0);
  const conTodo = { estado: 'activas', temporada: '', orden: 'lugar', busqueda: 'algarrobo' };
  expect(contarFiltrosActivos(conTodo, INICIALES)).toBe(1);
});

test('manda el conjunto de claves de los iniciales, no el del objeto actual', () => {
  const conExtra = { ...INICIALES, tecnico: 'u1' };
  expect(contarFiltrosActivos(conExtra, INICIALES)).toBe(0);
});

test('limpiar devuelve los filtros a su valor inicial y conserva la búsqueda y el orden', () => {
  const actuales = { estado: 'activas', temporada: '2025', orden: 'lugar', busqueda: 'algarrobo' };
  expect(limpiarFiltros(actuales, INICIALES)).toEqual({
    estado: 'todas',
    temporada: '',
    orden: 'lugar',
    busqueda: 'algarrobo',
  });
});

test('limpiar sin búsqueda ni orden en los filtros devuelve los iniciales', () => {
  const iniciales = { rol: 'todos', estado: 'todos' };
  expect(limpiarFiltros({ rol: 'admins', estado: 'activos' }, iniciales)).toEqual(iniciales);
});
