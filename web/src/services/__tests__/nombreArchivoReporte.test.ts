import { nombreArchivoReporte, type CatalogosDelNombre } from '../nombreArchivoReporte';

const CATALOGOS: CatalogosDelNombre = {
  parcelas: [{ id: 'parc-1', codigo: 'LP12' }],
  grupos: [{ id: 'gr-1', codigo: 'L10' }],
  especies: [{ id: 'sp-1', codigo: 'ANC' }],
};

const nombre = (filtros: Parameters<typeof nombreArchivoReporte>[2]) =>
  nombreArchivoReporte('San Sebastián', '2025-2026', filtros, CATALOGOS);

test('sin filtros lleva solo el lugar y el periodo', () => {
  expect(nombre({})).toBe('arboles-san-sebastian-2025-2026.pdf');
});

test('parcela, grupo y especie van por su código, en ese orden', () => {
  expect(nombre({ speciesId: 'sp-1', groupId: 'gr-1', parcelaId: 'parc-1' })).toBe(
    'arboles-san-sebastian-2025-2026-lp12-l10-anc.pdf',
  );
});

test('la especie sin identificar va como nn', () => {
  expect(nombre({ speciesId: 'NN' })).toBe('arboles-san-sebastian-2025-2026-nn.pdf');
});

test.each([
  [true, true, 'con-gps-con-foto'],
  [false, false, 'sin-gps-sin-foto'],
  [true, undefined, 'con-gps'],
  [undefined, false, 'sin-foto'],
])('GPS %s y foto %s → %s', (conGps, conFoto, detalle) => {
  expect(nombre({ conGps, conFoto })).toBe(`arboles-san-sebastian-2025-2026-${detalle}.pdf`);
});

test('la búsqueda por ID va al final, con su prefijo', () => {
  expect(nombre({ parcelaId: 'parc-1', conGps: false, busqueda: 'LP1L23BANC12-SS26' })).toBe(
    'arboles-san-sebastian-2025-2026-lp12-sin-gps-id-lp1l23banc12-ss26.pdf',
  );
});

test('un id que no está en el catálogo no se escribe', () => {
  expect(nombre({ parcelaId: 'otra', groupId: 'gr-1' })).toBe(
    'arboles-san-sebastian-2025-2026-l10.pdf',
  );
});
