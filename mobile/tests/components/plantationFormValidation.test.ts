// Validación del form de plantación: frecuencia GPS (#100) y campos de #633.

import {
  aCamposDePlantacion,
  fechaAIso,
  formatearFechaTipeada,
  isoAFecha,
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

describe('fecha de inicio', () => {
  it('pone las barras mientras se tipea y descarta lo que no es dígito', () => {
    expect(formatearFechaTipeada('1')).toBe('1');
    expect(formatearFechaTipeada('150')).toBe('15/0');
    expect(formatearFechaTipeada('15042026')).toBe('15/04/2026');
    expect(formatearFechaTipeada('15/04/20269')).toBe('15/04/2026');
    expect(formatearFechaTipeada('15-04')).toBe('15/04');
  });

  it('convierte a YYYY-MM-DD solo fechas reales', () => {
    expect(fechaAIso('15/04/2026')).toBe('2026-04-15');
    expect(fechaAIso('29/02/2024')).toBe('2024-02-29');
    expect(fechaAIso('29/02/2026')).toBeNull();
    expect(fechaAIso('31/04/2026')).toBeNull();
    expect(fechaAIso('15/4/2026')).toBeNull();
  });

  it('muestra la fecha de la base en DD/MM/AAAA', () => {
    expect(isoAFecha('2026-04-15')).toBe('15/04/2026');
    expect(isoAFecha(null)).toBe('');
  });
});

describe('validarFormulario', () => {
  const validos = { ...valoresIniciales(), lugar: 'Lote Norte', periodo: 'Otoño 2026' };

  it('acepta los opcionales vacíos', () => {
    expect(validarFormulario(validos)).toBeNull();
  });

  it('pide lugar y periodo de al menos 2 caracteres', () => {
    expect(validarFormulario({ ...validos, lugar: ' L ' })).not.toBeNull();
    expect(validarFormulario({ ...validos, periodo: '' })).not.toBeNull();
  });

  it('el objetivo, si está, es un entero ≥ 1 (CHECK de Supabase)', () => {
    expect(validarFormulario({ ...validos, objetivoArboles: '12000' })).toBeNull();
    for (const invalido of ['0', '-5', '2.5', 'mil']) {
      expect(validarFormulario({ ...validos, objetivoArboles: invalido })).not.toBeNull();
    }
  });

  it('la fecha, si está, tiene que ser real', () => {
    expect(validarFormulario({ ...validos, fechaInicio: '31/02/2026' })).not.toBeNull();
    expect(validarFormulario({ ...validos, fechaInicio: '15/04' })).not.toBeNull();
  });
});

describe('aCamposDePlantacion', () => {
  it('recorta, convierte y deja null lo vacío para poder borrarlo', () => {
    const campos = aCamposDePlantacion({
      ...valoresIniciales(),
      lugar: ' Lote Norte ',
      periodo: 'Otoño 2026',
      descripcion: '   ',
      fechaInicio: '15/04/2026',
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

  it('en edición arranca con los valores de la plantación', () => {
    const valores = valoresIniciales({
      lugar: 'Lote', periodo: '2026', descripcion: 'Ribera', fechaInicio: '2026-04-15',
      objetivoArboles: 300, photoCaptureAllTrees: true, visibleInApp: false,
    });
    expect(valores).toMatchObject({
      descripcion: 'Ribera', fechaInicio: '15/04/2026', objetivoArboles: '300',
      fotoEnTodos: true, visibleParaTecnicos: false,
    });
  });
});
