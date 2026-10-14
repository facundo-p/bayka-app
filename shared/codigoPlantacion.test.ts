import {
  errorCodigoPlantacion,
  idDeArbol,
  normalizarCodigoPlantacion,
  separarIdArbol,
} from './codigoPlantacion';

describe('normalizarCodigoPlantacion', () => {
  it('pasa a mayúsculas y saca los espacios', () => {
    expect(normalizarCodigoPlantacion(' ss 26-1 ')).toBe('SS26-1');
  });
});

describe('errorCodigoPlantacion', () => {
  it.each(['SS26-1', 'A-B-C', '12345678', 'P1'])('%s es válido', (codigo) => {
    expect(errorCodigoPlantacion(codigo)).toBeUndefined();
  });

  it('vacío es obligatorio', () => {
    expect(errorCodigoPlantacion('')).toBe('El código es obligatorio.');
  });

  it('más de ocho caracteres no', () => {
    expect(errorCodigoPlantacion('123456789')).toBe('El código tiene hasta 8 caracteres.');
  });

  it.each(['-SS26', 'SS26-', 'SS--26', 'ss26', 'SÑ26', 'SS_26'])('%s no', (codigo) => {
    expect(errorCodigoPlantacion(codigo)).toBe(
      'El código lleva solo letras, números y guiones sueltos, sin guion al principio ni al final.',
    );
  });
});

describe('idDeArbol', () => {
  it('es el SubID, un guion y el código de la plantación', () => {
    expect(idDeArbol('LP1L23BANC12', 'SS26-1')).toBe('LP1L23BANC12-SS26-1');
  });

  it.each([null, undefined, ''])('sin código de plantación (%p) es solo el SubID', (codigo) => {
    expect(idDeArbol('LP1L23BANC12', codigo)).toBe('LP1L23BANC12');
  });
});

describe('separarIdArbol', () => {
  const CODIGOS = ['SS26', 'SS26-1', 'LM25'];

  it('separa SubID y código', () => {
    expect(separarIdArbol('LP1L23BANC12-SS26', CODIGOS)).toEqual({
      subId: 'lp1l23banc12',
      codigo: 'SS26',
    });
  });

  it('con códigos con guion gana el más largo', () => {
    expect(separarIdArbol('LP1L23BANC12-SS26-1', CODIGOS)).toEqual({
      subId: 'lp1l23banc12',
      codigo: 'SS26-1',
    });
  });

  it('no distingue mayúsculas y devuelve el código canónico', () => {
    expect(separarIdArbol(' lp1l23banc12-ss26 ', CODIGOS)).toEqual({
      subId: 'lp1l23banc12',
      codigo: 'SS26',
    });
  });

  it.each(['LP1L23', 'LP1L23BANC12SS26', 'LP1L23-XX99', '-SS26', 'SS26'])(
    '%s no trae un código conocido: null',
    (texto) => {
      expect(separarIdArbol(texto, CODIGOS)).toBeNull();
    },
  );

  it('un código de otra organización (no listado) no se reconoce', () => {
    expect(separarIdArbol('LP1L23BANC12-ZZ99', CODIGOS)).toBeNull();
  });

  it('sin códigos conocidos devuelve null', () => {
    expect(separarIdArbol('LP1L23BANC12-SS26', [])).toBeNull();
  });
});
