import type { ArbolDetalle } from '../../../queries/dataExplorerQueries';
import { codigoParcelaDe, etiquetaEspecie, nombreTecnicoDe, tieneGps } from '../arbolFormato';

const ARBOL: ArbolDetalle = {
  id: 'tree-1',
  subId: 'A-001',
  posicion: 1,
  especieCodigo: null,
  especieNombre: null,
  grupoId: 'g-1',
  grupoCodigo: 'L1',
  parcelaId: 'parc-1',
  fotoUrl: null,
  usuarioRegistro: 'user-1',
  createdAt: '2026-06-03T12:00:00Z',
};

test('sin especie la etiqueta es N/N · Sin identificar', () => {
  expect(etiquetaEspecie(ARBOL)).toBe('N/N · Sin identificar');
  expect(etiquetaEspecie({ ...ARBOL, especieCodigo: 'QB', especieNombre: 'Quebracho' })).toBe(
    'QB · Quebracho',
  );
});

test('tieneGps exige las dos coordenadas', () => {
  expect(tieneGps(ARBOL)).toBe(false);
  expect(tieneGps({ ...ARBOL, latitude: -27.1 })).toBe(false);
  expect(tieneGps({ ...ARBOL, latitude: 0, longitude: 0 })).toBe(true);
});

test('los lookups devuelven null sin id, sin entrada o con nombre vacío', () => {
  const codigos = new Map([['parc-1', 'P1']]);
  const nombres = new Map([
    ['user-1', 'Ana'],
    ['user-2', ''],
  ]);
  expect(codigoParcelaDe(ARBOL, codigos)).toBe('P1');
  expect(codigoParcelaDe({ ...ARBOL, parcelaId: null }, codigos)).toBeNull();
  expect(codigoParcelaDe({ ...ARBOL, parcelaId: 'otra' }, codigos)).toBeNull();
  expect(nombreTecnicoDe(ARBOL, nombres)).toBe('Ana');
  expect(nombreTecnicoDe({ ...ARBOL, usuarioRegistro: null }, nombres)).toBeNull();
  expect(nombreTecnicoDe({ ...ARBOL, usuarioRegistro: 'user-2' }, nombres)).toBeNull();
});
