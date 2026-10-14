/**
 * Validación pura del formulario de especie (crear/editar).
 * Recibe los valores tal como se tipean (strings) y devuelve un error en
 * español por campo inválido. Sin acceso a datos: testeable aislado.
 */
import type { SubtipoEspecie, TipoEspecie } from '../../../shared/tiposEspecie';
import type { EspecieInput } from '../repositories/especieRepository';

/** Valor del selector cuando la especie no tiene especie científica. */
export const SIN_ESPECIE_CIENTIFICA = '';

/**
 * Tipo, subtipo y especie científica no se validan: salen de controles que solo ofrecen valores
 * válidos. `especieCientificaId` vacío es sin vínculo.
 */
export type EspecieFormValues = {
  codigo: string;
  nombre: string;
  especieCientificaId: string;
  tipo: TipoEspecie;
  subtipo: SubtipoEspecie;
};

export type CampoEspecie = 'codigo' | 'nombre';

export type ErroresEspecie = Partial<Record<CampoEspecie, string>>;

/** Valida el formulario completo; objeto vacío = sin errores. */
export function validarEspecie(valores: EspecieFormValues): ErroresEspecie {
  const errores: ErroresEspecie = {};
  if (valores.codigo.trim() === '') errores.codigo = 'El código es obligatorio';
  if (valores.nombre.trim() === '') errores.nombre = 'El nombre común es obligatorio';
  return errores;
}

export const MENSAJE_NOMBRE_CIENTIFICO_OBLIGATORIO = 'El nombre científico es obligatorio';

/** El nombre de una especie científica (#753); el server le saca los espacios de más. */
export function validarNombreCientifico(nombre: string): string | undefined {
  if (nombre.trim() === '') return MENSAJE_NOMBRE_CIENTIFICO_OBLIGATORIO;
}

export function hayErroresEspecie(errores: ErroresEspecie): boolean {
  return Object.keys(errores).length > 0;
}

/** Convierte los valores ya validados al input tipado del repository. */
export function aEspecieInput(valores: EspecieFormValues): EspecieInput {
  return {
    codigo: valores.codigo.trim(),
    nombre: valores.nombre.trim(),
    especieCientificaId:
      valores.especieCientificaId === SIN_ESPECIE_CIENTIFICA ? null : valores.especieCientificaId,
    tipo: valores.tipo,
    subtipo: valores.subtipo,
  };
}
