import type { EntradaNovedades } from '../parsearNovedades';
import { entradasVisibles, firmaNovedades } from '../novedades';

const EN_PRUEBAS: EntradaNovedades = {
  titulo: 'En pruebas · próxima versión',
  general: [],
  web: [],
  app: [],
  sincronizadoHasta: '5930146 #374',
};
const PUBLICADA: EntradaNovedades = {
  titulo: 'Web 1.1.0 · 21 de agosto de 2026',
  general: [{ detalle: 'Mejoras internas.' }],
  web: [
    { titular: 'Con pasos.', detalle: 'Publicado.', pasos: ['Abrí la web.', 'Esperá ver: algo.'] },
    { detalle: 'Sin pasos.' },
  ],
  app: [{ titular: 'En la app.', detalle: 'Con pasos.', pasos: ['Abrí Bayka TEST.'] }],
};

test('en staging se ven todas las entradas con sus pasos, la sección en pruebas incluida', () => {
  expect(entradasVisibles([EN_PRUEBAS, PUBLICADA], true)).toEqual([EN_PRUEBAS, PUBLICADA]);
});

test('en producción la sección en pruebas no se muestra aunque exista', () => {
  expect(entradasVisibles([EN_PRUEBAS, PUBLICADA], false)).toHaveLength(1);
});

// Los pasos quedan en el archivo para todas las versiones, pero son para quien prueba staging (#582).
test('en producción las entradas publicadas se ven sin pasos, en todas las plataformas', () => {
  const [publicada] = entradasVisibles([EN_PRUEBAS, PUBLICADA], false);

  expect(publicada).toEqual({
    titulo: PUBLICADA.titulo,
    general: [{ detalle: 'Mejoras internas.' }],
    web: [{ titular: 'Con pasos.', detalle: 'Publicado.' }, { detalle: 'Sin pasos.' }],
    app: [{ titular: 'En la app.', detalle: 'Con pasos.' }],
  });
});

test('la firma suma la marca de sincronización: cada sync re-enciende el aviso', () => {
  expect(firmaNovedades('v1.1.0', [EN_PRUEBAS, PUBLICADA])).toBe('v1.1.0 · 5930146 #374');
});

test('sin sección en pruebas la firma es solo la versión', () => {
  expect(firmaNovedades('v1.1.0', [PUBLICADA])).toBe('v1.1.0');
});

test('una sección en pruebas sin marca no cambia la firma', () => {
  const sinMarca = { ...EN_PRUEBAS, sincronizadoHasta: undefined };
  expect(firmaNovedades('v1.1.0', [sinMarca, PUBLICADA])).toBe('v1.1.0');
});
