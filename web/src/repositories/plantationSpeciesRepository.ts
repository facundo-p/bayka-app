import { errorDeSupabase } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';

/** Par especie + orden visual: la unidad de la lista que se manda al server. */
export type OrdenEspecie = { speciesId: string; ordenVisual: number };

const RPC_REEMPLAZAR_ESPECIES = 'reemplazar_especies_plantacion';

export const ERRORES_REEMPLAZO = {
  /** No es admin/superadmin activo de la organización de la plantación. */
  noAutorizado: 'NOT_AUTHORIZED',
  archivada: 'PLANTACION_ARCHIVADA',
  finalizada: 'PLANTACION_FINALIZADA',
} as const;

export const MENSAJE_ERROR_REEMPLAZO = 'No se pudo guardar el cambio de especies.';

const MENSAJES_ERROR_REEMPLAZO: Record<string, string> = {
  [ERRORES_REEMPLAZO.noAutorizado]: 'Tu usuario no tiene permisos para cambiar las especies.',
  [ERRORES_REEMPLAZO.archivada]: 'La plantación está archivada: no admite cambios.',
  [ERRORES_REEMPLAZO.finalizada]: 'La plantación está finalizada: no admite cambios.',
};

type RespuestaReemplazo = { success?: boolean; error?: string } | null;

/** Habilita la especie en la plantación al final de la lista (orden dado). */
export async function agregarEspecie(
  plantationId: string,
  speciesId: string,
  ordenVisual: number,
): Promise<void> {
  const { error } = await supabase.from('plantation_species').insert({
    plantation_id: plantationId,
    species_id: speciesId,
    orden_visual: ordenVisual,
  });
  if (error) throw errorDeSupabase(error);
}

/**
 * Deshabilita la especie en la plantación. La pantalla bloquea esta acción
 * si la especie tiene árboles registrados (paridad con mobile).
 */
export async function quitarEspecie(plantationId: string, speciesId: string): Promise<void> {
  const { error } = await supabase
    .from('plantation_species')
    .delete()
    .eq('plantation_id', plantationId)
    .eq('species_id', speciesId);
  if (error) throw errorDeSupabase(error);
}

/**
 * Deja habilitadas exactamente las especies de `especies`, con su orden, en una
 * sola transacción del server (RPC de 049). Antes eran un insert y un delete
 * sueltos: si fallaba el segundo, quedaban habilitadas especies que el admin
 * había quitado (#548). La decisión de qué habilitar o quitar —respetando las
 * bloqueadas por árboles— vive en `speciesChecklistSelection`, no acá.
 */
export async function reemplazarEspecies(
  plantationId: string,
  especies: OrdenEspecie[],
): Promise<void> {
  const { data, error } = await supabase.rpc(RPC_REEMPLAZAR_ESPECIES, {
    p_plantacion: plantationId,
    p_especies: especies.map(({ speciesId, ordenVisual }) => ({
      species_id: speciesId,
      orden_visual: ordenVisual,
    })),
  });
  if (error) throw errorDeSupabase(error);
  const respuesta = data as RespuestaReemplazo;
  if (!respuesta?.success) {
    throw new Error(MENSAJES_ERROR_REEMPLAZO[respuesta?.error ?? ''] ?? MENSAJE_ERROR_REEMPLAZO);
  }
}
