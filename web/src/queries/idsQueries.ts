/*
 * Generación y estado de los IDs finales de una plantación (espejo de hasIdsGenerated de mobile).
 * "Generar IDs" asigna `global_id` a todos los árboles; se considera generado solo cuando TODOS
 * lo tienen. La generación es exclusiva de la web vía el RPC transaccional `generate_tree_ids`
 * (numera y persiste server-side); la app recibe los IDs por el pull normal.
 */
import { supabase } from '../lib/supabase';
import { contarOLanzar } from './conteo';

/** Errores de negocio que devuelve `generate_tree_ids` en el payload `{ success: false, error }`. */
export const ERRORES_GENERACION_IDS = {
  /** El usuario no es admin/superadmin. */
  NO_AUTORIZADO: 'NOT_AUTHORIZED',
  /** Todos los árboles ya tienen `global_id` (regenerar requiere intervención manual). */
  YA_GENERADOS: 'ALREADY_GENERATED',
  SIN_ARBOLES: 'NO_TREES',
  /** El seed enviado es menor a 1. */
  SEED_INVALIDO: 'INVALID_SEED',
} as const;

const MENSAJES_ERROR_GENERACION: Record<string, string> = {
  [ERRORES_GENERACION_IDS.NO_AUTORIZADO]: 'Tu usuario no tiene permisos para generar IDs.',
  [ERRORES_GENERACION_IDS.YA_GENERADOS]:
    'Los IDs de esta plantación ya fueron generados (quizás desde otra sesión).',
  [ERRORES_GENERACION_IDS.SIN_ARBOLES]: 'Esta plantación no tiene árboles registrados.',
  [ERRORES_GENERACION_IDS.SEED_INVALIDO]: 'El ID inicial debe ser un número entero mayor a 0.',
};

const MENSAJE_ERROR_GENERACION = 'No se pudieron generar los IDs. Probá de nuevo.';

/** Cuenta árboles de la plantación; con `soloConId`, solo los que ya tienen `global_id`. */
async function contarArboles(plantationId: string, soloConId: boolean): Promise<number> {
  let consulta = supabase
    .from('trees')
    .select('id, groups!inner(plantation_id)', { count: 'exact', head: true })
    .eq('groups.plantation_id', plantationId);
  if (soloConId) consulta = consulta.not('global_id', 'is', null);
  const { count, error } = await consulta;
  return contarOLanzar(count, error);
}

/**
 * True solo si hay al menos un árbol y TODOS tienen `global_id` (un set parcial cuenta como NO
 * generado). Gobierna la visibilidad de "Generar IDs" vs. "Exportar".
 */
export async function idsGenerados(plantationId: string): Promise<boolean> {
  const [total, conId] = await Promise.all([
    contarArboles(plantationId, false),
    contarArboles(plantationId, true),
  ]);
  return total > 0 && total === conId;
}

/**
 * MAX(global_id) del server + 1 (1 si no hay ninguno). PostgREST no expone MAX directo: se toma
 * la primera fila ordenada descendente.
 */
export async function seedSugerido(): Promise<number> {
  const { data, error } = await supabase
    .from('trees')
    .select('global_id')
    .not('global_id', 'is', null)
    .order('global_id', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Array<{ global_id: number }>;
  return (filas[0]?.global_id ?? 0) + 1;
}

export type ResultadoGeneracionIds = { updated: number; seed: number };

type RespuestaGeneracion = {
  success: boolean;
  updated?: number;
  seed?: number;
  error?: string;
} | null;

/** Ejecuta el RPC `generate_tree_ids` y traduce sus códigos de error de negocio a mensajes en español. */
export async function generarIds(
  plantationId: string,
  seed: number,
): Promise<ResultadoGeneracionIds> {
  const { data, error } = await supabase.rpc('generate_tree_ids', {
    p_plantation_id: plantationId,
    p_seed: seed,
  });
  if (error) throw new Error(MENSAJE_ERROR_GENERACION);
  const respuesta = data as RespuestaGeneracion;
  if (!respuesta?.success) {
    throw new Error(MENSAJES_ERROR_GENERACION[respuesta?.error ?? ''] ?? MENSAJE_ERROR_GENERACION);
  }
  return { updated: respuesta.updated ?? 0, seed: respuesta.seed ?? seed };
}
