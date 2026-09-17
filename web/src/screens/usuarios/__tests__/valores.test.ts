import type { UsuarioConAsignaciones } from '../../../queries/usuarioQueries';
import {
  altaValida,
  cambiosDeEdicion,
  edicionValida,
  normalizar,
  VALORES_ALTA,
  valoresDeUsuario,
} from '../valores';

function usuario(sobreescritura: Partial<UsuarioConAsignaciones> = {}): UsuarioConAsignaciones {
  return {
    id: 'user-x',
    nombre: 'Equis',
    rol: 'tecnico',
    email: 'x@bayka.org',
    activo: true,
    organizacionId: 'org-1',
    organizacionNombre: 'Bayka',
    plantacionesAsignadas: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...sobreescritura,
  };
}

test('la edición arranca con los datos de la persona; sin email, vacío', () => {
  expect(valoresDeUsuario(usuario({ email: null }))).toEqual({
    nombre: 'Equis',
    email: '',
    rol: 'tecnico',
  });
});

test('el alta arranca vacía y como técnico', () => {
  expect(VALORES_ALTA).toEqual({ nombre: '', email: '', rol: 'tecnico' });
});

test('normalizar recorta nombre y email y conserva el rol', () => {
  expect(normalizar({ nombre: '  Ana ', email: ' ana@bayka.org  ', rol: 'admin' })).toEqual({
    nombre: 'Ana',
    email: 'ana@bayka.org',
    rol: 'admin',
  });
});

test.each([
  ['Ana', 'ana@bayka.org', true],
  [' Ana ', ' ana@bayka.org ', true],
  ['   ', 'ana@bayka.org', false],
  ['Ana', 'no-es-un-email', false],
  ['Ana', '', false],
])('alta con nombre "%s" y email "%s": válida = %s', (nombre, email, valida) => {
  expect(altaValida({ nombre, email, rol: 'tecnico' })).toBe(valida);
});

describe('cambiosDeEdicion', () => {
  const persona = usuario();

  test('sin tocar nada no hay nada que enviar', () => {
    expect(cambiosDeEdicion(persona, valoresDeUsuario(persona), true)).toEqual({});
  });

  test('solo los campos que cambiaron, recortados', () => {
    const valores = { ...valoresDeUsuario(persona), nombre: '  Nueva  ' };
    expect(cambiosDeEdicion(persona, valores, true)).toEqual({ nombre: 'Nueva' });
  });

  test('espacios en los bordes no cuentan como cambio', () => {
    const valores = { ...valoresDeUsuario(persona), nombre: 'Equis ', email: ' x@bayka.org' };
    expect(cambiosDeEdicion(persona, valores, true)).toEqual({});
  });

  test('una persona sin email que sigue sin email no cambia el email', () => {
    const sinEmail = usuario({ email: null });
    expect(cambiosDeEdicion(sinEmail, valoresDeUsuario(sinEmail), true)).toEqual({});
  });

  test('el rol cuenta solo si su guard deja cambiarlo', () => {
    const valores = { ...valoresDeUsuario(persona), rol: 'admin' as const };
    expect(cambiosDeEdicion(persona, valores, true)).toEqual({ rol: 'admin' });
    expect(cambiosDeEdicion(persona, valores, false)).toEqual({});
  });
});

describe('edicionValida', () => {
  const valores = valoresDeUsuario(usuario());

  test('sin cambios no se puede guardar', () => {
    expect(edicionValida(valores, {})).toBe(false);
  });

  test('sin nombre no se puede guardar aunque cambie otro campo', () => {
    expect(edicionValida({ ...valores, nombre: '  ' }, { email: 'otro@bayka.org' })).toBe(false);
  });

  test('un email nuevo tiene que ser válido', () => {
    expect(edicionValida(valores, { email: 'no-es-un-email' })).toBe(false);
    expect(edicionValida(valores, { email: 'otro@bayka.org' })).toBe(true);
  });

  test('cambiar solo el nombre o el rol alcanza', () => {
    expect(edicionValida(valores, { nombre: 'Nueva' })).toBe(true);
    expect(edicionValida(valores, { rol: 'admin' })).toBe(true);
  });
});
