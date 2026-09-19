import { clasificarError, errorDeSupabase, mensajeDeError } from '../clasificarError';

const ACCION = 'guardar la plantación';

describe('clasificarError', () => {
  test('la falla de fetch, como la devuelve supabase-js, es de red', () => {
    expect(clasificarError({ message: 'TypeError: Failed to fetch', code: '' })).toBe('red');
    expect(clasificarError(new Error('NetworkError when attempting to fetch resource.'))).toBe(
      'red',
    );
    expect(clasificarError(new Error('TypeError: Load failed'))).toBe('red');
  });

  test('la falla de red de una edge function es de red', () => {
    const error = Object.assign(new Error('Failed to send a request to the Edge Function'), {
      name: 'FunctionsFetchError',
    });
    expect(clasificarError(error)).toBe('red');
  });

  test('42501, 403 o el mensaje de RLS son falta de permiso', () => {
    expect(clasificarError({ message: 'x', code: '42501' })).toBe('permiso');
    expect(clasificarError({ message: 'x', status: 403 })).toBe('permiso');
    expect(
      clasificarError(new Error('new row violates row-level security policy for table "x"')),
    ).toBe('permiso');
  });

  test('cualquier otra cosa es un rechazo del servidor', () => {
    expect(clasificarError(new Error('duplicate key value'))).toBe('servidor');
    expect(clasificarError({ message: 'x', code: '23505' })).toBe('servidor');
    expect(clasificarError(null)).toBe('servidor');
    expect(clasificarError('boom')).toBe('servidor');
  });

  test('un TypeError de programación no se disfraza de problema de conexión', () => {
    expect(clasificarError(new TypeError('Cannot read properties of undefined'))).toBe('servidor');
  });
});

describe('mensajeDeError', () => {
  test('red: pide revisar la conexión', () => {
    expect(mensajeDeError(new Error('TypeError: Failed to fetch'), ACCION)).toBe(
      'No se pudo guardar la plantación. Revisá tu conexión y probá de nuevo.',
    );
  });

  test('permiso: lo dice sin culpar a la conexión', () => {
    expect(mensajeDeError({ message: 'x', code: '42501' }, ACCION)).toBe(
      'No tenés permiso para guardar la plantación.',
    );
  });

  test('servidor: muestra el detalle que mandó el server', () => {
    expect(mensajeDeError(new Error('  periodo inválido '), ACCION)).toBe(
      'No se pudo guardar la plantación: el servidor rechazó el cambio (periodo inválido).',
    );
    expect(mensajeDeError(null, ACCION)).toBe(
      'No se pudo guardar la plantación: el servidor rechazó el cambio.',
    );
  });
});

test('errorDeSupabase conserva mensaje y código', () => {
  const error = errorDeSupabase({ message: 'sin permisos', code: '42501' });
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe('sin permisos');
  expect(error).toMatchObject({ code: '42501' });
  expect(mensajeDeError(error, ACCION)).toBe('No tenés permiso para guardar la plantación.');
});
