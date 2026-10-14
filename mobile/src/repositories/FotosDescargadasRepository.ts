import { and, count, eq } from 'drizzle-orm';

import { db } from '../database/client';
import { enTransaccionPorLotes } from '../database/transaccion';
import { trees } from '../database/schema';
import { sqlIsLocalUri } from '../utils/photoUri';

export type FotoDescargada = { id: string; fotoUrl: string };

/** Foto local que se vuelve a apuntar al path de Storage que confirmó el server. */
export type FotoAVolverRemota = { id: string; local: string; remota: string };

/** Fotos con archivo en el celular que ya están en el server: las únicas que se pueden liberar. */
export async function getFotosDescargadas(): Promise<FotoDescargada[]> {
  const filas = await db
    .select({ id: trees.id, fotoUrl: trees.fotoUrl })
    .from(trees)
    .where(and(eq(trees.fotoSynced, true), sqlIsLocalUri(trees.fotoUrl)));
  return filas as FotoDescargada[];
}

/** Fotos sacadas en este celular que el server todavía no tiene: son la única copia. */
export async function contarFotosSinSubir(): Promise<number> {
  const [fila] = await db
    .select({ n: count() })
    .from(trees)
    .where(and(eq(trees.fotoSynced, false), sqlIsLocalUri(trees.fotoUrl)));
  return fila?.n ?? 0;
}

/**
 * Deja cada fila apuntando a su foto en Storage, como si nunca se hubiera descargado.
 * Solo si sigue igual que cuando se leyó —mismo archivo y ya subida—: una foto
 * reemplazada o quitada en el medio no se toca. Devuelve las que cambiaron.
 */
export async function volverFotosARemotas<T extends FotoAVolverRemota>(fotos: readonly T[]): Promise<T[]> {
  const cambiadas: T[] = [];
  await enTransaccionPorLotes([...fotos], async (tx, lote) => {
    for (const foto of lote) {
      const filas = await tx
        .update(trees)
        .set({ fotoUrl: foto.remota })
        .where(and(eq(trees.id, foto.id), eq(trees.fotoUrl, foto.local), eq(trees.fotoSynced, true)))
        .returning({ id: trees.id });
      if (filas.length > 0) cambiadas.push(foto);
    }
  });
  return cambiadas;
}
