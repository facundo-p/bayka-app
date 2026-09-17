import { db } from '../client';
import { plantations } from '../schema';
import { count } from 'drizzle-orm';
import { ESTADO_PLANTACION } from '../../constants/estados';

export const DEMO_PLANTATION_ID = '00000000-0000-0000-0000-000000000002';
export const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

export async function seedPlantationIfNeeded(): Promise<void> {
  const [result] = await db.select({ count: count() }).from(plantations);
  if (result.count > 0) return; // Idempotent

  await db.insert(plantations).values({
    id: DEMO_PLANTATION_ID,
    organizacionId: DEMO_ORG_ID,
    lugar: 'La Maluka - Zona Alta Lote 1',
    periodo: 'Otoño 2026',
    estado: ESTADO_PLANTACION.activa,
    creadoPor: 'system',
    createdAt: new Date().toISOString(),
  });
}
