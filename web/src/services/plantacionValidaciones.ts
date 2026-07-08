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
  objetivoArboles: string;
};

export type CampoValidado = 'lugar' | 'periodo' | 'objetivoArboles';

export type ErroresValidacion = Partial<Record<CampoValidado, string>>;

function numeroDe(texto: string): number {
  const limpio = texto.trim();
  return limpio === '' ? Number.NaN : Number(limpio);
}

function errorObjetivo(texto: string): string | undefined {
  if (texto.trim() === '') return undefined;
  const valor = numeroDe(texto);
  if (!Number.isInteger(valor) || valor < 1) {
    return 'El objetivo debe ser un número entero de al menos 1 árbol';
  }
}

/** Valida el formulario completo; objeto vacío = sin errores. */
export function validarPlantacion(valores: PlantacionFormValues): ErroresValidacion {
  const errores: ErroresValidacion = {};
  if (valores.lugar.trim() === '') errores.lugar = 'El lugar es obligatorio';
  if (valores.periodo.trim() === '') errores.periodo = 'El período es obligatorio';
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

/** Convierte los valores ya validados al input tipado del repository.
 *  Superficie y ubicación ya no se editan desde la web: quedan sin enviar
 *  (undefined), así editarPlantacion no las toca y conserva lo que haya. */
export function aPlantacionInput(valores: PlantacionFormValues): PlantacionInput {
  return {
    lugar: valores.lugar.trim(),
    periodo: valores.periodo.trim(),
    descripcion: textoOpcional(valores.descripcion),
    fechaInicio: textoOpcional(valores.fechaInicio),
    objetivoArboles: numeroOpcional(valores.objetivoArboles),
  };
}
