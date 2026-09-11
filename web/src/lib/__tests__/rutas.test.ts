import { matchPath } from 'react-router';
import {
  PARAM_URL,
  PATRON_DETALLE_PLANTACION,
  RUTA,
  rutaDatos,
  rutaPlantacion,
  rutaSeccion,
  SEGMENTO_DATOS,
  TAB_DETALLE,
} from '../rutas';

test('RUTA: la raíz de cada pantalla', () => {
  expect(RUTA).toEqual({
    login: '/login',
    establecerPassword: '/establecer-password',
    plantaciones: '/plantaciones',
    especies: '/especies',
    novedades: '/novedades',
    usuarios: '/usuarios',
  });
});

test('el patrón del detalle reconoce la ruta que arma rutaPlantacion', () => {
  expect(PATRON_DETALLE_PLANTACION).toBe('/plantaciones/:id');
  expect(matchPath(PATRON_DETALLE_PLANTACION, rutaPlantacion('p1'))?.params.id).toBe('p1');
});

test('rutaPlantacion: sin tab es el dashboard; con tab, su segmento', () => {
  expect(rutaPlantacion('p1')).toBe('/plantaciones/p1');
  expect(rutaPlantacion('p1', TAB_DETALLE.datos)).toBe('/plantaciones/p1/datos');
  expect(rutaPlantacion('p1', TAB_DETALLE.configuracion)).toBe('/plantaciones/p1/configuracion');
});

test('rutaDatos arma la ruta absoluta a la sección con los filtros', () => {
  expect(rutaDatos('p1', SEGMENTO_DATOS.parcelas)).toBe('/plantaciones/p1/datos/parcelas');
  const busqueda = new URLSearchParams({ [PARAM_URL.busqueda]: 'A 12/3' });
  expect(rutaDatos('p1', SEGMENTO_DATOS.arboles, busqueda)).toBe(
    '/plantaciones/p1/datos/arboles?q=A+12%2F3',
  );
});

test('rutaSeccion apunta a la sección hermana con los filtros', () => {
  const filtros = new URLSearchParams('parcela=p1&grupo=g1');
  expect(rutaSeccion(SEGMENTO_DATOS.arboles, filtros)).toBe('../arboles?parcela=p1&grupo=g1');
});

test('sin filtros no queda un "?" colgando', () => {
  expect(rutaSeccion(SEGMENTO_DATOS.grupos)).toBe('../grupos');
  expect(rutaSeccion(SEGMENTO_DATOS.grupos, new URLSearchParams())).toBe('../grupos');
  expect(rutaDatos('p1', SEGMENTO_DATOS.grupos, new URLSearchParams())).toBe(
    '/plantaciones/p1/datos/grupos',
  );
});
