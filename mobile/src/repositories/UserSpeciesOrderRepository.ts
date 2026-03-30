/**
 * Per-user species button order — local only (not synced).
 * Falls back to plantation_species.orden_visual when no custom order exists.
 */
import { db } from '../database/client';
import { userSpeciesOrder } from '../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';

/** Get user's custom species order for a plantation. Returns empty array if none set. */
export async function getUserSpeciesOrder(
  userId: string,
  plantacionId: string,
): Promise<Array<{ especieId: string; ordenVisual: number }>> {
  return db
    .select({
      especieId: userSpeciesOrder.especieId,
      ordenVisual: userSpeciesOrder.ordenVisual,
    })
    .from(userSpeciesOrder)
    .where(
      and(
        eq(userSpeciesOrder.userId, userId),
        eq(userSpeciesOrder.plantacionId, plantacionId),
      ),
    )
    .orderBy(userSpeciesOrder.ordenVisual);
}

/** Save user's custom species order for a plantation. Replaces any existing order. */
export async function saveUserSpeciesOrder(
  userId: string,
  plantacionId: string,
  items: Array<{ especieId: string; ordenVisual: number }>,
): Promise<void> {
  // Delete existing order for this user + plantation
  await db
    .delete(userSpeciesOrder)
    .where(
      and(
        eq(userSpeciesOrder.userId, userId),
        eq(userSpeciesOrder.plantacionId, plantacionId),
      ),
    );

  // Insert new order
  if (items.length > 0) {
    await db.insert(userSpeciesOrder).values(
      items.map((item) => ({
        userId,
        plantacionId,
        especieId: item.especieId,
        ordenVisual: item.ordenVisual,
      })),
    );
  }

  notifyDataChanged();
}
