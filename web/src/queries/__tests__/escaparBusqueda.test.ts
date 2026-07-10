import {
  citarValorOr,
  condicionIlikeOr,
  escaparComodinesLike,
  patronContiene,
} from '../escaparBusqueda';

describe('escaparComodinesLike', () => {
  test('no toca texto normal', () => {
    expect(escaparComodinesLike('PAL23ANC12')).toBe('PAL23ANC12');
    expect(escaparComodinesLike('A-0')).toBe('A-0');
    expect(escaparComodinesLike('')).toBe('');
  });

  test('escapa los comodines % y _', () => {
    expect(escaparComodinesLike('50%')).toBe('50\\%');
    expect(escaparComodinesLike('a_b')).toBe('a\\_b');
    expect(escaparComodinesLike('%_%')).toBe('\\%\\_\\%');
  });

  test('escapa el propio backslash (y lo hace primero)', () => {
    expect(escaparComodinesLike('a\\b')).toBe('a\\\\b');
    // Un `\%` del usuario debe quedar como `\\` + `\%` (backslash literal + % literal).
    expect(escaparComodinesLike('\\%')).toBe('\\\\\\%');
  });

  test('no toca comillas dobles (no son especiales para LIKE)', () => {
    expect(escaparComodinesLike('a"b')).toBe('a"b');
  });
});

describe('patronContiene', () => {
  test('rodea con comodines de borde reales y escapa el interior', () => {
    expect(patronContiene('PAL23')).toBe('%PAL23%');
    expect(patronContiene('A-0')).toBe('%A-0%');
    expect(patronContiene('50%')).toBe('%50\\%%');
    expect(patronContiene('a_b')).toBe('%a\\_b%');
  });
});

describe('citarValorOr', () => {
  test('envuelve en comillas dobles el texto normal', () => {
    expect(citarValorOr('%abc%')).toBe('"%abc%"');
  });

  test('escapa comillas dobles internas', () => {
    expect(citarValorOr('a"b')).toBe('"a\\"b"');
  });

  test('escapa backslashes internos (y antes que las comillas)', () => {
    expect(citarValorOr('a\\b')).toBe('"a\\\\b"');
    expect(citarValorOr('\\"')).toBe('"\\\\\\""');
  });
});

describe('condicionIlikeOr', () => {
  test('texto normal: patrón contiene entrecomillado', () => {
    expect(condicionIlikeOr('codigo', 'abc')).toBe('codigo.ilike."%abc%"');
  });

  test('una coma NO crea filtros fantasma (queda dentro de las comillas)', () => {
    const condicion = condicionIlikeOr('codigo', 'a,b');
    expect(condicion).toBe('codigo.ilike."%a,b%"');
    // La coma del usuario está entre comillas: no separa condiciones del .or().
    expect(condicion.slice('codigo.ilike.'.length)).toBe('"%a,b%"');
  });

  test('paréntesis y comas combinados quedan literales', () => {
    expect(condicionIlikeOr('nombre', '(x,y)')).toBe('nombre.ilike."%(x,y)%"');
  });

  test('% y _ del usuario se escapan como literales de LIKE', () => {
    // El `\` que agrega el escape de LIKE se duplica al entrecomillar (capa
    // gramática): PostgREST desescapa `\\`→`\`, y LIKE recibe `\%`/`\_` literal.
    expect(condicionIlikeOr('codigo', '50%')).toBe('codigo.ilike."%50\\\\%%"');
    expect(condicionIlikeOr('codigo', 'a_b')).toBe('codigo.ilike."%a\\\\_b%"');
  });

  test('comillas y backslash: escape LIKE + escape gramática PostgREST', () => {
    // `"` no es especial en LIKE, pero sí en la gramática → se escapa a `\"`.
    expect(condicionIlikeOr('codigo', 'a"b')).toBe('codigo.ilike."%a\\"b%"');
    // `\` del usuario: LIKE lo escapa a `\\`, luego la gramática duplica a `\\\\`.
    expect(condicionIlikeOr('codigo', 'a\\b')).toBe('codigo.ilike."%a\\\\\\\\b%"');
  });
});
