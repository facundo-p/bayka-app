import {
  errorCodigoPlantacion,
  idDeArbol,
  normalizarCodigoPlantacion,
} from '../../src/utils/codigoDePlantacion';

describe('normalizarCodigoPlantacion', () => {
  it('pasa a mayúsculas y saca los espacios', () => {
    expect(normalizarCodigoPlantacion(' ss 26-1 ')).toBe('SS26-1');
  });
});

describe('errorCodigoPlantacion', () => {
  it.each(['SS26-1', 'A-B-C', '12345678', 'P1'])('%s es válido', (codigo) => {
    expect(errorCodigoPlantacion(codigo)).toBeNull();
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

  it('sin código (plantación que todavía no lo bajó) es solo el SubID', () => {
    expect(idDeArbol('LP1L23BANC12', null)).toBe('LP1L23BANC12');
  });
});
