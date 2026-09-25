/**
 * Escrituras admin directas a Supabase (especies, técnicos) sobre una plantación que
 * pudo dejar de ser escribible desde que se cargó la pantalla: eliminada, archivada o
 * finalizada. El server lo rechaza por RLS o FK con un error opaco; esto lo traduce a
 * un mensaje que dice qué pasó (#522).
 */
import { supabase } from '../supabase/client';
import { SYNC_ERROR } from './sync/types';

export const RPC_MOTIVO_NO_ESCRIBIBLE = 'motivo_no_escribible';

/** Valores de `motivo_no_escribible` (server). */
export const MOTIVO_NO_ESCRIBIBLE = {
  inexistente: 'PLANTACION_INEXISTENTE',
  archivada: SYNC_ERROR.PLANTACION_ARCHIVADA,
  finalizada: SYNC_ERROR.PLANTACION_FINALIZADA,
} as const;

export type MotivoNoEscribible = (typeof MOTIVO_NO_ESCRIBIBLE)[keyof typeof MOTIVO_NO_ESCRIBIBLE];

const NO_SE_GUARDARON = 'Los cambios no se guardaron.';

const MENSAJE_POR_MOTIVO: Record<MotivoNoEscribible, string> = {
  [MOTIVO_NO_ESCRIBIBLE.inexistente]: `La plantación ya no existe en el servidor. ${NO_SE_GUARDARON}`,
  [MOTIVO_NO_ESCRIBIBLE.archivada]: `La plantación está archivada y no acepta cambios. ${NO_SE_GUARDARON}`,
  [MOTIVO_NO_ESCRIBIBLE.finalizada]:
    `La plantación está finalizada: solo un superadmin puede cambiar su configuración. ${NO_SE_GUARDARON}`,
};

const TODOS_LOS_MOTIVOS: readonly MotivoNoEscribible[] = Object.values(MOTIVO_NO_ESCRIBIBLE);

export function esMotivoNoEscribible(codigo: string): codigo is MotivoNoEscribible {
  return (TODOS_LOS_MOTIVOS as readonly string[]).includes(codigo);
}

/** Las especies siguen `plantacion_escribible`: bloquean los tres motivos. */
export const BLOQUEAN_ESPECIES = TODOS_LOS_MOTIVOS;

/** Las asignaciones de técnicos se admiten en una finalizada (migración 047). */
export const BLOQUEAN_ASIGNACIONES: readonly MotivoNoEscribible[] = [
  MOTIVO_NO_ESCRIBIBLE.inexistente,
  MOTIVO_NO_ESCRIBIBLE.archivada,
];

export class PlantacionNoEscribibleError extends Error {
  constructor(readonly motivo: MotivoNoEscribible) {
    super(MENSAJE_POR_MOTIVO[motivo]);
    this.name = 'PlantacionNoEscribibleError';
  }
}

/**
 * Sin respuesta (sin red, server sin el RPC) devuelve null: no bloquea, y la
 * escritura informa su propio error.
 */
async function consultarMotivo(plantacionId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc(RPC_MOTIVO_NO_ESCRIBIBLE, { p_plantation_id: plantacionId });
  return error ? null : (data ?? null);
}

function motivoBloqueante(motivo: string | null, bloquean: readonly MotivoNoEscribible[]): MotivoNoEscribible | null {
  return bloquean.find((m) => m === motivo) ?? null;
}

/** Para explicar una escritura que el server no aplicó (0 filas): cualquier motivo vale. */
export async function motivoNoEscribible(plantacionId: string): Promise<MotivoNoEscribible | null> {
  return motivoBloqueante(await consultarMotivo(plantacionId), TODOS_LOS_MOTIVOS);
}

async function errorSiNoEscribible(
  plantacionId: string,
  bloquean: readonly MotivoNoEscribible[],
): Promise<PlantacionNoEscribibleError | null> {
  const motivo = motivoBloqueante(await consultarMotivo(plantacionId), bloquean);
  return motivo ? new PlantacionNoEscribibleError(motivo) : null;
}

/**
 * Chequea antes, para no dejar la escritura a medias (borra y después no puede
 * insertar), y vuelve a chequear si falla, por si cambió en el medio.
 */
export async function escribirSiEsEscribible(
  plantacionId: string,
  bloquean: readonly MotivoNoEscribible[],
  escribir: () => Promise<void>,
): Promise<void> {
  const antes = await errorSiNoEscribible(plantacionId, bloquean);
  if (antes) throw antes;
  try {
    await escribir();
  } catch (error) {
    throw (await errorSiNoEscribible(plantacionId, bloquean)) ?? error;
  }
}
