import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';

/**
 * Mutaciones del catálogo de especies (tabla `species`): catálogo global sin columna de
 * organización/tenant, compartido por todas las orgs y por mobile — insert/update no setea
 * scope porque no existe. RLS: prod aún no tiene policy de INSERT/UPDATE, así que estas
 * mutaciones fallan con insufficient_privilege hasta que se agregue por migración.
 */

/** `nombreCientifico` null cuando el campo quedó vacío, así el update lo limpia en la base. */
export type EspecieInput = {
  codigo: string;
  nombre: string;
  nombreCientifico: string | null;
};

export const MENSAJE_CODIGO_DUPLICADO = 'Ya existe una especie con ese código.';

/** Código duplicado (UNIQUE sobre `codigo`); el modal lo distingue del error genérico. */
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

/** unique_violation sobre `codigo` → CodigoEspecieDuplicadoError; el resto, mensaje crudo. */
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
 * Cambiar `codigo` es seguro: las FKs referencian `species_id`, no el string `codigo` (que solo
 * alimenta etiqueta/color en la UI) — por eso se permite editarlo aun con la especie en uso.
 */
export async function editarEspecie(id: string, input: EspecieInput): Promise<void> {
  const { error } = await supabase.from('species').update(aPayload(input)).eq('id', id);
  if (error) throw traducirError(error);
}
