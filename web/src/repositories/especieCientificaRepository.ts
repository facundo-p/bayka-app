import { errorDeSupabase } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';
import { PG_ERROR } from '../lib/postgresErrorCodes';

/**
 * Mutaciones de las especies científicas (#753), catálogo global como `species`: RLS deja escribir
 * solo a un admin activo. El server normaliza los espacios del nombre y lo hace único sin
 * distinguir mayúsculas.
 */

export const MENSAJE_NOMBRE_CIENTIFICO_DUPLICADO =
  'Ya existe una especie científica con ese nombre.';
export const MENSAJE_ESPECIE_CIENTIFICA_EN_USO =
  'Agrupa especies: desvinculalas antes de eliminarla.';

/** Nombre repetido (índice único sobre el nombre en minúsculas). */
export class NombreCientificoDuplicadoError extends Error {
  constructor() {
    super(MENSAJE_NOMBRE_CIENTIFICO_DUPLICADO);
    this.name = 'NombreCientificoDuplicadoError';
  }
}

/** La FK de species la protege: alguien la vinculó entre que se abrió el panel y se confirmó. */
export class EspecieCientificaEnUsoError extends Error {
  constructor() {
    super(MENSAJE_ESPECIE_CIENTIFICA_EN_USO);
    this.name = 'EspecieCientificaEnUsoError';
  }
}

type ErrorSupabase = { message: string; code?: string };

function traducirError(error: ErrorSupabase): Error {
  if (error.code === PG_ERROR.UNIQUE_VIOLATION) return new NombreCientificoDuplicadoError();
  if (error.code === PG_ERROR.FOREIGN_KEY_VIOLATION) return new EspecieCientificaEnUsoError();
  return errorDeSupabase(error);
}

/** Devuelve el id creado. */
export async function crearEspecieCientifica(nombre: string): Promise<string> {
  const { data, error } = await supabase
    .from('especies_cientificas')
    .insert({ nombre })
    .select('id')
    .single();
  if (error) throw traducirError(error);
  return (data as { id: string }).id;
}

/** El server copia el nombre nuevo a todas las especies que agrupa. */
export async function editarEspecieCientifica(id: string, nombre: string): Promise<void> {
  const { error } = await supabase.from('especies_cientificas').update({ nombre }).eq('id', id);
  if (error) throw traducirError(error);
}

export async function eliminarEspecieCientifica(id: string): Promise<void> {
  const { error } = await supabase.from('especies_cientificas').delete().eq('id', id);
  if (error) throw traducirError(error);
}
