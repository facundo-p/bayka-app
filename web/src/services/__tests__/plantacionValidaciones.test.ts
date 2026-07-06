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
    superficieHa: '',
    ubicacionLat: '',
    ubicacionLng: '',
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

test('superficie 0, negativa o no numérica es inválida', () => {
  expect(validarPlantacion(valores({ superficieHa: '0' })).superficieHa).toBeDefined();
  expect(validarPlantacion(valores({ superficieHa: '-2' })).superficieHa).toBeDefined();
  expect(validarPlantacion(valores({ superficieHa: 'abc' })).superficieHa).toBeDefined();
  expect(validarPlantacion(valores({ superficieHa: '12.5' })).superficieHa).toBeUndefined();
});

test('latitud sin longitud (y viceversa) marca el campo faltante', () => {
  const sinLng = validarPlantacion(valores({ ubicacionLat: '-32.9' }));
  expect(sinLng.ubicacionLng).toBe('Completá la longitud: va junto con la latitud');
  expect(sinLng.ubicacionLat).toBeUndefined();

  const sinLat = validarPlantacion(valores({ ubicacionLng: '-68.8' }));
  expect(sinLat.ubicacionLat).toBe('Completá la latitud: va junto con la longitud');
  expect(sinLat.ubicacionLng).toBeUndefined();
});

test('lat/lng fuera de rango son inválidas; en el límite son válidas', () => {
  const fueraDeRango = validarPlantacion(valores({ ubicacionLat: '90.1', ubicacionLng: '-180.5' }));
  expect(fueraDeRango.ubicacionLat).toBe('La latitud debe ser un número entre -90 y 90');
  expect(fueraDeRango.ubicacionLng).toBe('La longitud debe ser un número entre -180 y 180');

  const enElLimite = validarPlantacion(valores({ ubicacionLat: '-90', ubicacionLng: '180' }));
  expect(enElLimite).toEqual({});
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
      superficieHa: '12.5',
      ubicacionLat: '-32.9',
      ubicacionLng: '-68.8',
      objetivoArboles: '500',
    }),
  );
  expect(input).toEqual({
    lugar: 'Mendoza',
    periodo: '2025-2026',
    descripcion: 'Finca norte',
    fechaInicio: undefined,
    superficieHa: 12.5,
    ubicacionLat: -32.9,
    ubicacionLng: -68.8,
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
