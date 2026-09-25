import { errorDeSupabase } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';

/** Especies a habilitar y a quitar: cada lado toca solo lo suyo (#635). */
export type CambiosEspecies = { altas: string[]; bajas: string[] };

const RPC_APLICAR_CAMBIOS_ESPECIES = 'aplicar_cambios_especies';

export const ERRORES_REEMPLAZO = {
  /** No es admin/superadmin activo de la organización de la plantación. */
  noAutorizado: 'NOT_AUTHORIZED',
  archivada: 'PLANTACION_ARCHIVADA',
  finalizada: 'PLANTACION_FINALIZADA',
  especieConArboles: 'ESPECIE_CON_ARBOLES',
  especieInexistente: 'ESPECIE_INEXISTENTE',
} as const;

export const MENSAJE_ERROR_REEMPLAZO = 'No se pudo guardar el cambio de especies.';

const MENSAJE_ESPECIE_CON_ARBOLES = 'La especie ya tiene árboles registrados: no se puede quitar.';

const MENSAJES_ERROR_REEMPLAZO: Record<string, string> = {
  [ERRORES_REEMPLAZO.noAutorizado]: 'Tu usuario no tiene permisos para cambiar las especies.',
  [ERRORES_REEMPLAZO.archivada]: 'La plantación está archivada: no admite cambios.',
  [ERRORES_REEMPLAZO.finalizada]: 'La plantación está finalizada: no admite cambios.',
  [ERRORES_REEMPLAZO.especieConArboles]: MENSAJE_ESPECIE_CON_ARBOLES,
  [ERRORES_REEMPLAZO.especieInexistente]: 'La especie ya no existe en el catálogo.',
};

type Rechazada = { species_id: string; error: string };
type RespuestaCambios = { success?: boolean; error?: string; rechazadas?: Rechazada[] } | null;

function mensajeDe(codigo: string | undefined): string {
  return MENSAJES_ERROR_REEMPLAZO[codigo ?? ''] ?? MENSAJE_ERROR_REEMPLAZO;
}

/**
 * Habilita y quita especies en una transacción del server. Por cambio y no por lista:
 * así no pisa lo que un teléfono cambió en otras especies (#635). Una baja con árboles
 * se rechaza sola y el resto se aplica; se informa igual, porque la pantalla la mostró
 * quitada. Qué habilitar o quitar —respetando las bloqueadas— lo decide
 * `speciesChecklistSelection`.
 */
export async function aplicarCambiosEspecies(
  plantationId: string,
  { altas, bajas }: CambiosEspecies,
): Promise<void> {
  const { data, error } = await supabase.rpc(RPC_APLICAR_CAMBIOS_ESPECIES, {
    p_plantacion: plantationId,
    p_altas: altas,
    p_bajas: bajas,
  });
  if (error) throw errorDeSupabase(error);
  const respuesta = data as RespuestaCambios;
  if (!respuesta?.success) throw new Error(mensajeDe(respuesta?.error));
  const [rechazada] = respuesta.rechazadas ?? [];
  if (rechazada) throw new Error(mensajeDe(rechazada.error));
}
