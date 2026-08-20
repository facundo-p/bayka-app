import { diagnosticarEnvSupabase } from '../envSupabase';

const REF = 'reftest';
const URL_VALIDA = `https://${REF}.supabase.co`;
/** La firma no se verifica: para los tests alcanza con el largo correcto. */
const FIRMA = 'a'.repeat(43);

function base64url(valor: object): string {
  return btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function crearKey({ ref = REF, role = 'anon' } = {}): string {
  return [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ iss: 'supabase', ref, role }),
    FIRMA,
  ].join('.');
}

const KEY_VALIDA = crearKey();

/** Los mensajes de los diagnósticos de un nivel, para asertar sin acoplarse al orden. */
function mensajes(url: unknown, anonKey: unknown, nivel: 'error' | 'aviso'): string {
  return diagnosticarEnvSupabase(url, anonKey)
    .filter((d) => d.nivel === nivel)
    .map((d) => d.mensaje)
    .join('\n');
}

const errores = (url: unknown, anonKey: unknown) => mensajes(url, anonKey, 'error');
const avisos = (url: unknown, anonKey: unknown) => mensajes(url, anonKey, 'aviso');

test('no diagnostica nada cuando el par es coherente', () => {
  expect(diagnosticarEnvSupabase(URL_VALIDA, KEY_VALIDA)).toEqual([]);
});

test('falla si falta alguna de las dos variables', () => {
  expect(errores(undefined, KEY_VALIDA)).toMatch(/Faltan VITE_SUPABASE_URL/);
  expect(errores(URL_VALIDA, '')).toMatch(/Faltan VITE_SUPABASE_URL/);
});

test('falla si la URL no es una URL', () => {
  expect(errores('VITE_SUPABASE_URLhttps://x.supabase.co', KEY_VALIDA)).toMatch(/no es una URL/);
});

test('falla si la anon key es de otro proyecto que la URL', () => {
  const salida = errores(URL_VALIDA, crearKey({ ref: 'otroproyecto' }));
  expect(salida).toMatch(/otroproyecto/);
  expect(salida).toMatch(REF);
});

test('falla si la anon key trae el nombre de la variable pegado adelante', () => {
  expect(errores(URL_VALIDA, `VITE_SUP${KEY_VALIDA}`)).toMatch(/forma de JWT/);
});

test('falla si la anon key tiene texto pegado al final de la firma', () => {
  expect(errores(URL_VALIDA, `${KEY_VALIDA}ABASE_ANON_KEY`)).toMatch(/firma/);
});

test('falla si le pasan la service_role key en lugar de la anon', () => {
  expect(errores(URL_VALIDA, crearKey({ role: 'service_role' }))).toMatch(/service_role/);
});

test('falla si le pasan una secret key del formato nuevo', () => {
  expect(errores(URL_VALIDA, 'sb_secret_loquesea')).toMatch(/secret key/);
});

test('avisa sin bloquear si la key es del formato nuevo, que no lleva el proyecto adentro', () => {
  expect(errores(URL_VALIDA, 'sb_publishable_loquesea')).toBe('');
  expect(avisos(URL_VALIDA, 'sb_publishable_loquesea')).toMatch(/formato nuevo/);
});

test('avisa sin bloquear si la URL no es un proyecto hosteado', () => {
  expect(errores('http://localhost:54321', KEY_VALIDA)).toBe('');
  expect(avisos('http://localhost:54321', KEY_VALIDA)).toMatch(/localhost/);
});
