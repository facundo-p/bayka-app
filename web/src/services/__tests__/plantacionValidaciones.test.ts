import {
  aPlantacionInput,
  errorFrecuenciaGps,
  hayErrores,
  validarPlantacion,
  type PlantacionFormValues,
} from '../plantacionValidaciones';

/** Valores válidos de base; cada test pisa lo que necesita. */
function valores(cambios: Partial<PlantacionFormValues> = {}): PlantacionFormValues {
  return {
    lugar: 'Mendoza',
    periodo: '2025-2026',
    descripcion: '',
    fechaInicio: '',
    objetivoArboles: '',
    ...cambios,
  };
}

test('con lugar y período (y opcionales vacíos) no hay errores', () => {
  expect(validarPlantacion(valores())).toEqual({});
  expect(hayErrores({})).toBe(false);
});

test('lugar y período son obligatorios (los espacios no cuentan)', () => {
  const errores = validarPlantacion(valores({ lugar: '   ', periodo: '' }));
  expect(errores.lugar).toBe('El lugar es obligatorio');
  expect(errores.periodo).toBe('El período es obligatorio');
  expect(hayErrores(errores)).toBe(true);
});

test('objetivo decimal, menor a 1 o no numérico es inválido', () => {
  const mensaje = 'El objetivo debe ser un número entero de al menos 1 árbol';
  expect(validarPlantacion(valores({ objetivoArboles: '10.5' })).objetivoArboles).toBe(mensaje);
  expect(validarPlantacion(valores({ objetivoArboles: '0' })).objetivoArboles).toBe(mensaje);
  expect(validarPlantacion(valores({ objetivoArboles: 'x' })).objetivoArboles).toBe(mensaje);
  expect(validarPlantacion(valores({ objetivoArboles: '500' }))).toEqual({});
});

test('aPlantacionInput recorta textos y convierte números; vacíos quedan undefined', () => {
  const input = aPlantacionInput(
    valores({
      lugar: '  Mendoza ',
      descripcion: ' Finca norte ',
      objetivoArboles: '500',
    }),
  );
  expect(input).toEqual({
    lugar: 'Mendoza',
    periodo: '2025-2026',
    descripcion: 'Finca norte',
    fechaInicio: undefined,
    objetivoArboles: 500,
  });
});

test('errorFrecuenciaGps rechaza decimales, menores a 1, vacíos y no numéricos', () => {
  const mensaje = 'La frecuencia debe ser un número entero de al menos 1';
  expect(errorFrecuenciaGps('2.5')).toBe(mensaje);
  expect(errorFrecuenciaGps('0')).toBe(mensaje);
  expect(errorFrecuenciaGps('')).toBe(mensaje);
  expect(errorFrecuenciaGps('x')).toBe(mensaje);
  expect(errorFrecuenciaGps('10')).toBeUndefined();
  expect(errorFrecuenciaGps(' 1 ')).toBeUndefined();
});
