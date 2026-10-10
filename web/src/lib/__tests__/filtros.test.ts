import { contarFiltrosActivos, limpiarFiltros } from '../filtros';

const INICIALES = { estado: 'todas', temporada: '', orden: 'arboles' };

test('sin cambios respecto de los iniciales no hay ninguno activo', () => {
  expect(contarFiltrosActivos(INICIALES, INICIALES)).toBe(0);
  expect(contarFiltrosActivos({ ...INICIALES }, INICIALES)).toBe(0);
});

test('cuenta uno por cada filtro que se apartó de su valor inicial', () => {
  expect(contarFiltrosActivos({ ...INICIALES, estado: 'activas' }, INICIALES)).toBe(1);
  expect(
    contarFiltrosActivos({ estado: 'activas', temporada: '2025', orden: 'lugar' }, INICIALES),
  ).toBe(2);
});

test('el orden no cuenta: no descarta filas y queda a la vista, fuera del panel', () => {
  expect(contarFiltrosActivos({ ...INICIALES, orden: 'creada' }, INICIALES)).toBe(0);
  expect(contarFiltrosActivos({ ...INICIALES, estado: 'activas', orden: 'lugar' }, INICIALES)).toBe(
    1,
  );
});

test('manda el conjunto de claves de los iniciales, no el del objeto actual', () => {
  const conExtra = { ...INICIALES, busqueda: 'algarrobo' };
  expect(contarFiltrosActivos(conExtra, INICIALES)).toBe(0);
});

test('limpiar devuelve los filtros a su valor inicial y conserva el orden elegido', () => {
  const actuales = { estado: 'activas', temporada: '2025', orden: 'lugar' };
  expect(limpiarFiltros(actuales, INICIALES)).toEqual({
    estado: 'todas',
    temporada: '',
    orden: 'lugar',
  });
});

test('limpiar sin orden en los filtros devuelve los iniciales tal cual', () => {
  const iniciales = { rol: 'todos', estado: 'todos' };
  expect(limpiarFiltros({ rol: 'admins', estado: 'activos' }, iniciales)).toBe(iniciales);
});
