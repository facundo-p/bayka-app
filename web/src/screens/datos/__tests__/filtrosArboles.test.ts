import { aFiltrosArboles, FILTROS_INICIALES, GPS_CON, GPS_SIN } from '../filtrosArboles';

test('filtros iniciales están todos vacíos', () => {
  expect(FILTROS_INICIALES).toEqual({
    parcelaId: '',
    groupId: '',
    speciesId: '',
    gps: '',
    busqueda: '',
  });
});

test('mapea filtros vacíos a undefined en todos los campos', () => {
  expect(aFiltrosArboles(FILTROS_INICIALES)).toEqual({
    parcelaId: undefined,
    groupId: undefined,
    speciesId: undefined,
    conGps: undefined,
    busqueda: undefined,
  });
});

test('mapea ids de parcela, grupo y especie tal cual cuando están seteados', () => {
  const resultado = aFiltrosArboles({
    ...FILTROS_INICIALES,
    parcelaId: 'p1',
    groupId: 'g1',
    speciesId: 's1',
  });
  expect(resultado.parcelaId).toBe('p1');
  expect(resultado.groupId).toBe('g1');
  expect(resultado.speciesId).toBe('s1');
});

test('gps "con" mapea a conGps true', () => {
  expect(aFiltrosArboles({ ...FILTROS_INICIALES, gps: GPS_CON }).conGps).toBe(true);
});

test('gps "sin" mapea a conGps false', () => {
  expect(aFiltrosArboles({ ...FILTROS_INICIALES, gps: GPS_SIN }).conGps).toBe(false);
});

test('busqueda se recorta (trim) antes de mandarse', () => {
  expect(aFiltrosArboles({ ...FILTROS_INICIALES, busqueda: '  A-12  ' }).busqueda).toBe('A-12');
});

test('busqueda vacía después de trim se mapea a undefined', () => {
  expect(aFiltrosArboles({ ...FILTROS_INICIALES, busqueda: '   ' }).busqueda).toBeUndefined();
});
