// Validación del form de plantación: frecuencia GPS (#100) y campos de #633.

import {
  aCamposDePlantacion,
  validarFormulario,
  validateGpsFrequency,
  valoresIniciales,
} from '../../src/utils/formularioDePlantacion';

describe('validateGpsFrequency', () => {
  it('acepta enteros ≥ 1', () => {
    expect(validateGpsFrequency('1')).toBeNull();
    expect(validateGpsFrequency('10')).toBeNull();
    expect(validateGpsFrequency(' 25 ')).toBeNull();
  });

  it('rechaza 0, negativos, decimales, vacío y texto', () => {
    for (const invalid of ['0', '-3', '2.5', '', '  ', 'abc', '10a']) {
      expect(validateGpsFrequency(invalid)).not.toBeNull();
    }
  });
});

describe('validarFormulario', () => {
  const validos = { ...valoresIniciales(), lugar: 'Lote Norte', periodo: 'Otoño 2026' };

  it('acepta los opcionales vacíos', () => {
    expect(validarFormulario(validos)).toBeNull();
  });

  it('pide lugar y periodo de al menos 2 caracteres', () => {
    expect(validarFormulario({ ...validos, lugar: ' L ' })).toBe('Lugar debe tener al menos 2 caracteres.');
    expect(validarFormulario({ ...validos, periodo: '' })).not.toBeNull();
  });

  it('el objetivo, si está, es un entero entre 1 (CHECK de Supabase) y el máximo', () => {
    expect(validarFormulario({ ...validos, objetivoArboles: '12000' })).toBeNull();
    expect(validarFormulario({ ...validos, objetivoArboles: '10000000' })).toBeNull();
    for (const invalido of ['0', '-5', '2.5', 'mil', '10000001', '2147483648']) {
      expect(validarFormulario({ ...validos, objetivoArboles: invalido })).not.toBeNull();
    }
  });
});

describe('aCamposDePlantacion', () => {
  it('recorta, convierte y deja null lo vacío para poder borrarlo', () => {
    const campos = aCamposDePlantacion({
      ...valoresIniciales(),
      lugar: ' Lote Norte ',
      periodo: 'Otoño 2026',
      descripcion: '   ',
      fechaInicio: '2026-04-15',
      objetivoArboles: ' 12000 ',
      gpsFrequency: '5',
      fotoEnTodos: true,
      visibleParaTecnicos: false,
    });
    expect(campos).toEqual({
      lugar: 'Lote Norte',
      periodo: 'Otoño 2026',
      descripcion: null,
      fechaInicio: '2026-04-15',
      objetivoArboles: 12000,
      gpsCaptureFrequency: 5,
      gpsCaptureRequired: true,
      photoCaptureAllTrees: true,
      visibleInApp: false,
    });
  });

  it('no recorta la descripción: abrir y guardar no la reescribe', () => {
    const campos = aCamposDePlantacion({ ...valoresIniciales(), lugar: 'Lote', periodo: '2026', descripcion: 'Ribera ' });
    expect(campos.descripcion).toBe('Ribera ');
  });

  it('sin fecha guarda null: la ✕ la borra', () => {
    const campos = aCamposDePlantacion({ ...valoresIniciales(), lugar: 'Lote', periodo: '2026', fechaInicio: '' });
    expect(campos.fechaInicio).toBeNull();
  });

  it('en edición arranca con los valores de la plantación', () => {
    const valores = valoresIniciales({
      lugar: 'Lote', periodo: '2026', descripcion: 'Ribera', fechaInicio: '2026-04-15',
      objetivoArboles: 300, photoCaptureAllTrees: true, visibleInApp: false,
    });
    expect(valores).toMatchObject({
      descripcion: 'Ribera', fechaInicio: '2026-04-15', objetivoArboles: '300',
      fotoEnTodos: true, visibleParaTecnicos: false,
    });
  });
});
