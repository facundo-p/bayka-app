import type { SubtipoEspecie, TipoEspecie } from '../../../shared/tiposEspecie';
import { errorDeSupabase } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';

/**
 * Mutaciones del catálogo de especies (tabla `species`): catálogo global sin columna de
 * organización/tenant, compartido por todas las orgs y por mobile — insert/update no setea
 * scope porque no existe. RLS: prod aún no tiene policy de INSERT/UPDATE, así que estas
 * mutaciones fallan con insufficient_privilege hasta que se agregue por migración.
 */

/**
 * `especieCientificaId` null desvincula. El nombre científico no se escribe: el server lo copia de
 * la especie científica (#753).
 */
export type EspecieInput = {
  codigo: string;
  nombre: string;
  especieCientificaId: string | null;
  tipo: TipoEspecie;
  subtipo: SubtipoEspecie;
};

export const MENSAJE_CODIGO_DUPLICADO = 'Ya existe una especie con ese código.';

/** Código duplicado (UNIQUE sobre `codigo`); el modal lo distingue del error genérico. */
export class CodigoEspecieDuplicadoError extends Error {
  constructor() {
    super(MENSAJE_CODIGO_DUPLICADO);
    this.name = 'CodigoEspecieDuplicadoError';
  }
}

type Payload = {
  codigo: string;
  nombre: string;
  especie_cientifica_id: string | null;
  tipo: TipoEspecie;
  subtipo: SubtipoEspecie;
};
type ErrorSupabase = { message: string; code?: string } | null;

function aPayload(input: EspecieInput): Payload {
  return {
    codigo: input.codigo,
    nombre: input.nombre,
    especie_cientifica_id: input.especieCientificaId,
    tipo: input.tipo,
    subtipo: input.subtipo,
  };
}

/** unique_violation sobre `codigo` → CodigoEspecieDuplicadoError; el resto, mensaje crudo. */
function traducirError(error: NonNullable<ErrorSupabase>): Error {
  if (error.code === PG_ERROR.UNIQUE_VIOLATION) return new CodigoEspecieDuplicadoError();
  return errorDeSupabase(error);
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
