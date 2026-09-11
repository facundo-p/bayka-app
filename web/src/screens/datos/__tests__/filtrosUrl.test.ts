import { FILTROS_INICIALES } from '../filtrosArboles';
import { filtrosAParams, hayFiltroActivo, leerFiltrosDeUrl } from '../filtrosUrl';

test('leerFiltrosDeUrl mapea cada query param a su campo (vacío si falta)', () => {
  const params = new URLSearchParams('parcela=p1&grupo=g1&especie=e1&gps=con&foto=sin&q=A-12');
  expect(leerFiltrosDeUrl(params)).toEqual({
    parcelaId: 'p1',
    groupId: 'g1',
    speciesId: 'e1',
    gps: 'con',
    foto: 'sin',
    busqueda: 'A-12',
  });
  expect(leerFiltrosDeUrl(new URLSearchParams())).toEqual(FILTROS_INICIALES);
});

test('un gps o foto ajeno en la URL cuenta como "todos"', () => {
  const filtros = leerFiltrosDeUrl(new URLSearchParams('gps=quizas&foto=1&parcela=p1'));
  expect(filtros.gps).toBe('');
  expect(filtros.foto).toBe('');
  expect(filtros.parcelaId).toBe('p1');
});

test('filtrosAParams omite los campos vacíos y usa las claves de URL', () => {
  const params = filtrosAParams({ parcelaId: 'p1', busqueda: 'A-12', groupId: '' });
  expect(params.get('parcela')).toBe('p1');
  expect(params.get('q')).toBe('A-12');
  expect(params.has('grupo')).toBe(false);
});

test('hayFiltroActivo distingue el estado inicial de uno con filtro', () => {
  expect(hayFiltroActivo(FILTROS_INICIALES)).toBe(false);
  expect(hayFiltroActivo({ ...FILTROS_INICIALES, parcelaId: 'p1' })).toBe(true);
  expect(hayFiltroActivo({ ...FILTROS_INICIALES, gps: 'sin' })).toBe(true);
});

test('roundtrip: filtrosAParams → leerFiltrosDeUrl preserva los valores', () => {
  const filtros = { ...FILTROS_INICIALES, parcelaId: 'p1', speciesId: 'NN', foto: 'con' as const };
  expect(leerFiltrosDeUrl(filtrosAParams(filtros))).toEqual(filtros);
});
