/**
 * Edición de los campos de una plantación por `editar_plantacion` (#634): se sube solo lo
 * que cambió, con la base de cada campo, y el server no aplica los que alguien cambió en la
 * web mientras tanto. Lo usan la edición online y el push de ediciones offline.
 */
import { eq } from 'drizzle-orm';
import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { plantations } from '../../database/schema';
import { aColumnasRemotas, aSnapshot, hayCambios, type CamposDePlantacion } from '../../utils/camposDePlantacion';
import {
  aplicados,
  combinarConflictos,
  conflictosDesdeRemotos,
  valoresDeLaWeb,
  type ConflictoRemoto,
} from '../../utils/conflictosDeEdicion';

export const RPC_EDITAR_PLANTACION = 'editar_plantacion';

/** Además de estos, rechaza con los de `motivo_no_escribible` (finalizada, archivada, inexistente). */
export const ERROR_EDICION = {
  conflicto: 'CONFLICTO_EDICION',
  noAutorizado: 'NOT_AUTHORIZED',
  datosInvalidos: 'DATOS_INVALIDOS',
} as const;

const MENSAJE_RECHAZO: Record<string, string> = {
  [ERROR_EDICION.noAutorizado]: 'Tu usuario no tiene permisos para editar esta plantación.',
  [ERROR_EDICION.datosInvalidos]: 'El servidor rechazó un dato inválido. Revisá el formulario.',
};

export function mensajeDeRechazo(codigo: string): string {
  return MENSAJE_RECHAZO[codigo] ?? 'No se pudo guardar la plantación. Probá de nuevo.';
}

/** `rechazo`: el server no aplicó nada. Si no, aplicó todo salvo `conflictos`. */
export type ResultadoEdicion = { rechazo: string | null; conflictos: ConflictoRemoto[] };

const SIN_RECHAZO: ResultadoEdicion = { rechazo: null, conflictos: [] };

export const esRechazada = (resultado: ResultadoEdicion): boolean => resultado.rechazo !== null;

type RespuestaRemota = { success?: boolean; error?: string; conflictos?: ConflictoRemoto[] } | null;

/**
 * Sube `cambios` con su `base`. Un error de PostgREST o de red se lanza tal cual: el caller
 * decide si reintenta (push) o cae al camino offline (edición online).
 */
export async function subirEdicion(
  plantacionId: string,
  cambios: Partial<CamposDePlantacion>,
  base: Partial<CamposDePlantacion>,
): Promise<ResultadoEdicion> {
  if (!hayCambios(cambios)) return SIN_RECHAZO;
  const { data, error } = await supabase.rpc(RPC_EDITAR_PLANTACION, {
    p_id: plantacionId,
    p_cambios: aColumnasRemotas(cambios),
    p_base: aColumnasRemotas(base),
  });
  if (error) throw error;
  const respuesta = data as RespuestaRemota;
  if (respuesta?.success) return SIN_RECHAZO;
  if (respuesta?.error === ERROR_EDICION.conflicto) return { rechazo: null, conflictos: respuesta.conflictos ?? [] };
  return { rechazo: respuesta?.error ?? '', conflictos: [] };
}

type FilaDePlantacion = typeof plantations.$inferSelect;

type EdicionSubida = {
  /** Valores a dejar en la fila (la edición completa). */
  vivos: Partial<CamposDePlantacion>;
  cambios: Partial<CamposDePlantacion>;
  base: Partial<CamposDePlantacion>;
  resultado: ResultadoEdicion;
};

/**
 * Refleja en SQLite una edición que el server aceptó: lo aplicado queda como valor y como
 * snapshot; lo que chocó queda con el valor de la web y como conflicto a resolver. Devuelve
 * cuántos conflictos quedan pendientes en la plantación.
 */
export async function registrarEdicionSubida(fila: FilaDePlantacion, edicion: EdicionSubida): Promise<number> {
  const mioEn = fila.editadaLocalmenteEn ?? new Date().toISOString();
  const nuevos = conflictosDesdeRemotos(edicion.resultado.conflictos, { ...edicion, mioEn });
  const web = valoresDeLaWeb(nuevos);
  const conflictos = combinarConflictos(fila.conflictosDeEdicion, edicion.cambios, nuevos);
  await db
    .update(plantations)
    .set({
      ...edicion.vivos,
      ...web,
      ...aSnapshot({ ...aplicados(edicion.cambios, nuevos), ...web }),
      pendingEdit: false,
      baseDeEdicion: null,
      editadaLocalmenteEn: null,
      conflictosDeEdicion: conflictos,
    })
    .where(eq(plantations.id, fila.id));
  return conflictos?.length ?? 0;
}
