/**
 * Purga de filas locales huérfanas (issue #71, causa raíz del naranja
 * permanente).
 *
 * Origen del residuo: borrar una plantación descargada no eliminaba sus
 * parcelas hasta #90, y el cliente SQLite no activa PRAGMA foreign_keys, así
 * que esas filas quedaron colgadas sin plantación. Son insincronizables (el
 * push recorre las plantaciones locales, nunca las alcanza) e invisibles (no
 * hay tarjeta que las muestre), pero el conteo global las ve → OrangeDot
 * encendido para siempre.
 *
 * Se ejecuta como pre-step de todo sync: elimina grupos/árboles/parcelas cuya
 * plantación (o grupo) ya no existe localmente. No toca datos alcanzables.
 */
import { db } from '../../database/client';
import { groups, trees, parcelas } from '../../database/schema';
import { count, sql, type SQL } from 'drizzle-orm';
import { syncLog } from '../../utils/syncLogger';
import { runInTransaction } from './paginate';

export interface OrphanPurgeResult {
  groups: number;
  trees: number;
  parcelas: number;
}

// Condiciones de orfandad (referencian columnas por nombre físico de tabla).
const GROUPS_HUERFANOS: SQL = sql`plantacion_id NOT IN (SELECT id FROM plantations)`;
const TREES_HUERFANOS: SQL = sql`group_id IN (SELECT id FROM groups WHERE plantacion_id NOT IN (SELECT id FROM plantations)) OR group_id NOT IN (SELECT id FROM groups)`;
const PARCELAS_HUERFANAS: SQL = sql`plantacion_id NOT IN (SELECT id FROM plantations)`;

async function countWhere(tx: any, table: any, condition: SQL): Promise<number> {
  const rows = await tx.select({ cnt: count() }).from(table).where(condition);
  return rows?.[0]?.cnt ?? 0;
}

export async function purgeOrphanRows(): Promise<OrphanPurgeResult> {
  const result: OrphanPurgeResult = { groups: 0, trees: 0, parcelas: 0 };

  await runInTransaction(db, async (tx: any) => {
    result.groups = await countWhere(tx, groups, GROUPS_HUERFANOS);
    result.trees = await countWhere(tx, trees, TREES_HUERFANOS);
    result.parcelas = await countWhere(tx, parcelas, PARCELAS_HUERFANAS);

    if (result.groups + result.trees + result.parcelas === 0) return;

    // Orden: árboles → grupos → parcelas (hijos antes que padres).
    await tx.delete(trees).where(TREES_HUERFANOS);
    await tx.delete(groups).where(GROUPS_HUERFANOS);
    await tx.delete(parcelas).where(PARCELAS_HUERFANAS);
  });

  if (result.groups + result.trees + result.parcelas > 0) {
    syncLog.info(
      `Purga de huérfanos: ${result.groups} grupos, ${result.trees} árboles, ${result.parcelas} parcelas`);
  }
  return result;
}
