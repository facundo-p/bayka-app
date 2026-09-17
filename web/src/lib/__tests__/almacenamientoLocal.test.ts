import { CLAVE_STORAGE, guardarLocal, leerLocal } from '../almacenamientoLocal';

const CLAVE = CLAVE_STORAGE.novedadesUltimaVista;

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function bloquearStorage() {
  const error = new DOMException('bloqueado', 'SecurityError');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw error;
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw error;
  });
}

test('lo guardado se lee de vuelta', () => {
  guardarLocal(CLAVE, 'v1.2.0');
  expect(leerLocal(CLAVE)).toBe('v1.2.0');
});

test('una clave sin valor se lee como null', () => {
  expect(leerLocal(CLAVE)).toBeNull();
});

test('con el storage bloqueado, leer da null y guardar no lanza', () => {
  bloquearStorage();
  expect(leerLocal(CLAVE)).toBeNull();
  expect(() => guardarLocal(CLAVE, 'v1.2.0')).not.toThrow();
});

test('las claves conservan el prefijo que ya tienen guardado los navegadores', () => {
  expect(CLAVE_STORAGE).toEqual({
    novedadesUltimaVista: 'bayka.novedades.ultima-vista',
    recientesCommandMenu: 'bayka.command-menu.recientes',
  });
});
