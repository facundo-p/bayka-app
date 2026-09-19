import { contarFiltrosActivos } from '../filtros';

const INICIALES = { estado: 'todas', temporada: '', orden: 'arboles' };

test('sin cambios respecto de los iniciales no hay ninguno activo', () => {
  expect(contarFiltrosActivos(INICIALES, INICIALES)).toBe(0);
  expect(contarFiltrosActivos({ ...INICIALES }, INICIALES)).toBe(0);
});

test('cuenta uno por cada filtro que se apartó de su valor inicial', () => {
  expect(contarFiltrosActivos({ ...INICIALES, estado: 'activas' }, INICIALES)).toBe(1);
  expect(contarFiltrosActivos({ ...INICIALES, estado: 'activas', orden: 'lugar' }, INICIALES)).toBe(
    2,
  );
  expect(
    contarFiltrosActivos({ estado: 'activas', temporada: '2025', orden: 'lugar' }, INICIALES),
  ).toBe(3);
});

test('el orden cuenta aunque no descarte ninguna fila: también es un filtro puesto', () => {
  expect(contarFiltrosActivos({ ...INICIALES, orden: 'creada' }, INICIALES)).toBe(1);
});

test('manda el conjunto de claves de los iniciales, no el del objeto actual', () => {
  const conExtra = { ...INICIALES, busqueda: 'algarrobo' };
  expect(contarFiltrosActivos(conExtra, INICIALES)).toBe(0);
});
