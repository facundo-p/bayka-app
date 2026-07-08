import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';

/**
 * Mutaciones del catálogo de especies (tabla `species`).
 *
 * OJO — CATÁLOGO GLOBAL COMPARTIDO: `species` NO tiene columna de organización
 * ni tenant (ver migración 001: `codigo text not null unique`). Es un catálogo
 * único compartido por todas las organizaciones y consumido también por la app
 * mobile. Crear o editar una especie desde la web afecta a TODOS los consumidores.
 * Por eso el insert/update no setea ninguna columna de scope: no existe.
 *
 * Nota de RLS: la tabla tiene RLS habilitado con una única policy de SELECT
 * para usuarios autenticados. En prod aún no hay policy de INSERT/UPDATE sobre
 * `species`, así que estas mutaciones fallarán con insufficient_privilege hasta
 * que se agregue la policy correspondiente por migración. El error se propaga
 * con su mensaje al usuario (mismo criterio que el resto de los repos web).
 */

/** Campos editables de una especie, ya validados. `nombreCientifico` null
 *  cuando el campo quedó vacío (así el update lo limpia en la base). */
export type EspecieInput = {
  codigo: string;
  nombre: string;
  nombreCientifico: string | null;
};

export const MENSAJE_CODIGO_DUPLICADO = 'Ya existe una especie con ese código.';

/** Error específico de código duplicado (UNIQUE sobre `codigo`). El modal lo
 *  distingue del error genérico para mostrar el aviso correcto. */
export class CodigoEspecieDuplicadoError extends Error {
  constructor() {
    super(MENSAJE_CODIGO_DUPLICADO);
    this.name = 'CodigoEspecieDuplicadoError';
  }
}

type Payload = { codigo: string; nombre: string; nombre_cientifico: string | null };
type ErrorSupabase = { message: string; code?: string } | null;

function aPayload(input: EspecieInput): Payload {
  return {
    codigo: input.codigo,
    nombre: input.nombre,
    nombre_cientifico: input.nombreCientifico,
  };
}

/** Traduce el error de Supabase: unique_violation sobre `codigo` →
 *  CodigoEspecieDuplicadoError; cualquier otro, su mensaje crudo. */
function traducirError(error: NonNullable<ErrorSupabase>): Error {
  if (error.code === PG_ERROR.UNIQUE_VIOLATION) return new CodigoEspecieDuplicadoError();
  return new Error(error.message);
}

/** Crea una especie en el catálogo global. Devuelve el id creado. */
export async function crearEspecie(input: EspecieInput): Promise<string> {
  const { data, error } = await supabase
    .from('species')
    .insert(aPayload(input))
    .select('id')
    .single();
  if (error) throw traducirError(error);
  return (data as { id: string }).id;
}

/**
 * Edita una especie del catálogo global. Cambiar `codigo` es seguro a nivel
 * referencial: plantation_species y trees referencian la especie por `species_id`
 * (FK al id), no por el string `codigo`. El código solo alimenta la etiqueta y el
 * color determinístico en la UI (colorEspeciePorCodigo), así que editarlo es
 * cosmético — por eso se permite aun cuando la especie ya está en uso.
 */
export async function editarEspecie(id: string, input: EspecieInput): Promise<void> {
  const { error } = await supabase.from('species').update(aPayload(input)).eq('id', id);
  if (error) throw traducirError(error);
}
