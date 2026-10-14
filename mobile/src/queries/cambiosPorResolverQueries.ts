import { eq } from 'drizzle-orm';
import { db } from '../database/client';
import { plantations } from '../database/schema';
import type { ConflictoDeCampo } from '../utils/conflictosDeEdicion';

export type CambiosPorResolver = { lugar: string; conflictos: ConflictoDeCampo[] };

/** Los campos de la plantación que chocaron con la web y esperan que el usuario elija (#634). */
export async function getCambiosPorResolver(plantacionId: string): Promise<CambiosPorResolver | null> {
  const [fila] = await db
    .select({ lugar: plantations.lugar, conflictos: plantations.conflictosDeEdicion })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  if (!fila) return null;
  return { lugar: fila.lugar, conflictos: fila.conflictos ?? [] };
}
