/**
 * Validación pura del formulario de plantación (crear/editar).
 * Recibe los valores tal como se tipean (strings) y devuelve un error
 * en español por campo inválido. Sin acceso a datos: testeable aislado.
 */
import type { PlantacionInput } from '../repositories/plantationRepository';

export type PlantacionFormValues = {
  lugar: string;
  periodo: string;
  descripcion: string;
  fechaInicio: string;
  superficieHa: string;
  ubicacionLat: string;
  ubicacionLng: string;
  objetivoArboles: string;
};

export type CampoValidado =
  | 'lugar'
  | 'periodo'
  | 'superficieHa'
  | 'ubicacionLat'
  | 'ubicacionLng'
  | 'objetivoArboles';

export type ErroresValidacion = Partial<Record<CampoValidado, string>>;

const LATITUD_MAX = 90;
const LONGITUD_MAX = 180;

function numeroDe(texto: string): number {
  const limpio = texto.trim();
  return limpio === '' ? Number.NaN : Number(limpio);
}

function errorSuperficie(texto: string): string | undefined {
  if (texto.trim() === '') return undefined;
  const valor = numeroDe(texto);
  if (Number.isNaN(valor) || valor <= 0) return 'La superficie debe ser un número mayor a 0';
}

function errorObjetivo(texto: string): string | undefined {
  if (texto.trim() === '') return undefined;
  const valor = numeroDe(texto);
  if (!Number.isInteger(valor) || valor < 1) {
    return 'El objetivo debe ser un número entero de al menos 1 árbol';
  }
}

function errorCoordenada(texto: string, limite: number, nombre: string): string | undefined {
  const valor = numeroDe(texto);
  if (Number.isNaN(valor) || Math.abs(valor) > limite) {
    return `La ${nombre} debe ser un número entre -${limite} y ${limite}`;
  }
}

/** Lat y lng van juntas: una sin la otra es error en la que falta. */
function erroresUbicacion(lat: string, lng: string): ErroresValidacion {
  const hayLat = lat.trim() !== '';
  const hayLng = lng.trim() !== '';
  if (!hayLat && !hayLng) return {};
  const errores: ErroresValidacion = {};
  const errorLat = hayLat
    ? errorCoordenada(lat, LATITUD_MAX, 'latitud')
    : 'Completá la latitud: va junto con la longitud';
  const errorLng = hayLng
    ? errorCoordenada(lng, LONGITUD_MAX, 'longitud')
    : 'Completá la longitud: va junto con la latitud';
  if (errorLat) errores.ubicacionLat = errorLat;
  if (errorLng) errores.ubicacionLng = errorLng;
  return errores;
}

/** Valida el formulario completo; objeto vacío = sin errores. */
export function validarPlantacion(valores: PlantacionFormValues): ErroresValidacion {
  const errores: ErroresValidacion = erroresUbicacion(valores.ubicacionLat, valores.ubicacionLng);
  if (valores.lugar.trim() === '') errores.lugar = 'El lugar es obligatorio';
  if (valores.periodo.trim() === '') errores.periodo = 'El período es obligatorio';
  const superficie = errorSuperficie(valores.superficieHa);
  if (superficie) errores.superficieHa = superficie;
  const objetivo = errorObjetivo(valores.objetivoArboles);
  if (objetivo) errores.objetivoArboles = objetivo;
  return errores;
}

export function hayErrores(errores: ErroresValidacion): boolean {
  return Object.keys(errores).length > 0;
}

/** Frecuencia de captura GPS: entero ≥ 1. Se valida antes de tocar la base. */
export function errorFrecuenciaGps(texto: string): string | undefined {
  const valor = numeroDe(texto);
  if (!Number.isInteger(valor) || valor < 1) {
    return 'La frecuencia debe ser un número entero de al menos 1';
  }
}

function textoOpcional(texto: string): string | undefined {
  const limpio = texto.trim();
  return limpio === '' ? undefined : limpio;
}

function numeroOpcional(texto: string): number | undefined {
  const valor = numeroDe(texto);
  return Number.isNaN(valor) ? undefined : valor;
}

/** Convierte los valores ya validados al input tipado del repository. */
export function aPlantacionInput(valores: PlantacionFormValues): PlantacionInput {
  return {
    lugar: valores.lugar.trim(),
    periodo: valores.periodo.trim(),
    descripcion: textoOpcional(valores.descripcion),
    fechaInicio: textoOpcional(valores.fechaInicio),
    superficieHa: numeroOpcional(valores.superficieHa),
    ubicacionLat: numeroOpcional(valores.ubicacionLat),
    ubicacionLng: numeroOpcional(valores.ubicacionLng),
    objetivoArboles: numeroOpcional(valores.objetivoArboles),
  };
}
