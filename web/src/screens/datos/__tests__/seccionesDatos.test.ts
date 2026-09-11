import { rutaSeccion, SEGMENTO_DATOS } from '../seccionesDatos';

test('rutaSeccion apunta a la sección hermana con los filtros', () => {
  const filtros = new URLSearchParams('parcela=p1&grupo=g1');
  expect(rutaSeccion(SEGMENTO_DATOS.arboles, filtros)).toBe('../arboles?parcela=p1&grupo=g1');
});

test('rutaSeccion sin filtros no deja un "?" colgando', () => {
  expect(rutaSeccion(SEGMENTO_DATOS.grupos)).toBe('../grupos');
  expect(rutaSeccion(SEGMENTO_DATOS.grupos, new URLSearchParams())).toBe('../grupos');
});
