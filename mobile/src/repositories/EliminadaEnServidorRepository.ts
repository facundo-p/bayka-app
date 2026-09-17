/**
 * Marca local de plantación eliminada en el servidor (#478). La escribe el pull según
 * lo que responde `estado_remoto_plantaciones`; no tiene espejo en Supabase.
 */
import { db } from '../database/client';
import { plantations } from '../database/schema';
import { and, eq, isNull, isNotNull } from 'drizzle-orm';

/** Solo si no estaba marcada: se conserva la fecha en que se detectó por primera vez. */
export async function marcarEliminadaEnServidor(plantacionId: string): Promise<void> {
  await db
    .update(plantations)
    .set({ eliminadaEnServidorEn: new Date().toISOString() })
    .where(and(eq(plantations.id, plantacionId), isNull(plantations.eliminadaEnServidorEn)));
}

/** El server volvió a reconocerla (p.ej. se restauró): deja de ser solo lectura por esto. */
export async function desmarcarEliminadaEnServidor(plantacionId: string): Promise<void> {
  await db
    .update(plantations)
    .set({ eliminadaEnServidorEn: null })
    .where(and(eq(plantations.id, plantacionId), isNotNull(plantations.eliminadaEnServidorEn)));
}
