/*
 * Generación y estado de los IDs finales de una plantación.
 *
 * Regla de negocio (espejo de hasIdsGenerated de mobile, ver docs/SPECS.md §4.17
 * y docs/ui-ux-guidelines.md §19): "Generar IDs" asigna el `global_id` final a
 * todos los árboles; sólo cuando TODOS lo tienen se considera generado.
 * Mientras tanto se sigue ofreciendo "Generar IDs"; la exportación recién
 * aparece cuando los IDs están confirmados.
 *
 * Desde el issue #232 la generación es exclusiva de la web: el RPC
 * transaccional `generate_tree_ids` (migración 029) numera y persiste
 * server-side; la app recibe los IDs por el pull normal.
 */
import { supabase } from '../lib/supabase';
import { contarOLanzar } from './conteo';

// ─── Códigos de error del RPC generate_tree_ids ──────────────────────────────

/**
 * Errores de negocio que devuelve `generate_tree_ids` en el payload
 * (`{ success: false, error }`, migración 029). Constantes nombradas para no
 * comparar literales sueltos (regla "sin magic constants").
 */
export const ERRORES_GENERACION_IDS = {
  /** El usuario no es admin/superadmin. */
  NO_AUTORIZADO: 'NOT_AUTHORIZED',
  /** Todos los árboles ya tienen `global_id` (regenerar requiere intervención manual). */
  YA_GENERADOS: 'ALREADY_GENERATED',
  /** La plantación no tiene árboles. */
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

/** Cuenta árboles de la plantación; con `soloConId`, sólo los que ya tienen
 *  `global_id` (ID final asignado y confirmado en el server). */
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
 * True sólo cuando hay al menos un árbol y TODOS tienen `global_id`. Un set
 * parcial (sync incompleto) cuenta como NO generado. Gobierna la visibilidad de
 * "Generar IDs" (hasta generar) y "Exportar" (sólo después).
 */
export async function idsGenerados(plantationId: string): Promise<boolean> {
  const [total, conId] = await Promise.all([
    contarArboles(plantationId, false),
    contarArboles(plantationId, true),
  ]);
  return total > 0 && total === conId;
}

/**
 * Seed sugerido para el ID global: MAX(global_id) del server + 1 (1 si no hay
 * ninguno). PostgREST no expone MAX directo: se toma la primera fila ordenada
 * descendente.
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

/**
 * Ejecuta el RPC transaccional `generate_tree_ids` (migración 029) y traduce
 * sus códigos de error de negocio a mensajes en español para la UI.
 */
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
