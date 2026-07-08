/*
 * Estado de generación de IDs finales de una plantación.
 *
 * Regla de negocio (espejo de hasIdsGenerated de mobile, ver docs/SPECS.md §4.17
 * y docs/ui-ux-guidelines.md §19): "Generar IDs" asigna el `global_id` final a
 * todos los árboles y los sube al server; sólo cuando TODOS lo tienen se
 * considera generado. Mientras tanto se sigue ofreciendo "Generar IDs"; la
 * exportación recién aparece cuando los IDs están confirmados.
 */
import { supabase } from '../lib/supabase';
import { contarOLanzar } from './conteo';

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
