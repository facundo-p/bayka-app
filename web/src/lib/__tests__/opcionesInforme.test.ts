import {
  guardarOpcionesInforme,
  leerOpcionesInforme,
  opcionesCon,
  opcionesSegunObjetivo,
  SIN_OPCIONES,
} from '../opcionesInforme';

const CLAVE = 'bayka.informe.opciones';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('la primera vez arrancan todas sin marcar', () => {
  expect(leerOpcionesInforme()).toEqual({ meta: false, gps: false, foto: false, mapa: false });
});

test('lo guardado se lee de vuelta', () => {
  guardarOpcionesInforme(opcionesCon(['gps', 'mapa']));
  expect(window.localStorage.getItem(CLAVE)).toBe('["gps","mapa"]');
  expect(leerOpcionesInforme()).toEqual({ meta: false, gps: true, foto: false, mapa: true });
});

test.each([
  ['un JSON roto', '{gps'],
  ['algo que no es una lista', '{"gps":true}'],
])('con %s arrancan sin marcar', (_, crudo) => {
  window.localStorage.setItem(CLAVE, crudo);
  expect(leerOpcionesInforme()).toEqual(SIN_OPCIONES);
});

test('ignora las opciones que ya no existen', () => {
  window.localStorage.setItem(CLAVE, '["foto","parcelas",3]');
  expect(leerOpcionesInforme()).toEqual(opcionesCon(['foto']));
});

test('con el storage bloqueado arrancan sin marcar y guardar no lanza', () => {
  const error = new DOMException('bloqueado', 'SecurityError');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw error;
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw error;
  });
  expect(leerOpcionesInforme()).toEqual(SIN_OPCIONES);
  expect(() => guardarOpcionesInforme(opcionesCon(['mapa']))).not.toThrow();
});

describe('opcionesSegunObjetivo', () => {
  const todas = opcionesCon(['foto', 'gps', 'mapa', 'meta']);

  test('con objetivo respeta la elección', () => {
    expect(opcionesSegunObjetivo(todas, 8000)).toBe(todas);
  });

  test.each([null, 0])('con objetivo %s la meta cuenta como no marcada', (objetivo) => {
    expect(opcionesSegunObjetivo(todas, objetivo)).toEqual({ ...todas, meta: false });
  });
});
