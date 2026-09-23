import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { plantationSpecies, species, trees, userSpeciesOrder } from '../../database/schema';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { syncLog } from '../../utils/syncLogger';
import { fetchAllRows } from './paginate';
import { enTransaccion, FILAS_POR_TRANSACCION } from '../../database/transaccion';
import { abortarSiCancelado, relanzarSiEsCancelacion } from './cancelacion';

/** Fila de especie del server, normalizada a los nombres del schema local. */
type ServerSpecies = { id: string; codigo: string; nombre: string; nombre_cientifico?: string | null; created_at: string };

/** Ejecutor drizzle: el cliente `db` o una transacción `tx`. */
type DbExecutor = Pick<typeof db, 'insert' | 'update' | 'delete' | 'select'>;

const GUARDADO = { upserted: 'upserted', reconciled: 'reconciled', skipped: 'skipped' } as const;
type Guardado = typeof GUARDADO[keyof typeof GUARDADO];
type ConteoDeGuardado = Record<Guardado, number>;

/** Upsert de especies del server por `id` (clave estable entre devices) en un statement; actualiza codigo/nombre/cientifico en conflicto. */
async function upsertSpeciesById(exec: DbExecutor, filas: ServerSpecies[]): Promise<void> {
  if (filas.length === 0) return;
  await exec.insert(species).values(filas.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    nombreCientifico: s.nombre_cientifico ?? null,
    createdAt: s.created_at,
  }))).onConflictDoUpdate({
    target: species.id,
    set: {
      codigo: sql`excluded.codigo`,
      nombre: sql`excluded.nombre`,
      nombreCientifico: sql`excluded.nombre_cientifico`,
    },
  });
}

/**
 * Reconcilia una colisión UNIQUE(codigo): el server trae una especie con `id` distinto al de una fila
 * local que ya usa ese `codigo`. Re-apunta todas las referencias del id local duplicado al id del
 * server y borra la fila duplicada, en una transacción atómica. El `codigo` se preserva, así que los
 * SubID (que lo embeben, no el id) siguen siendo válidos.
 * @returns true si reconcilió; false si no había duplicado (el error era otro y debe propagarse).
 */
async function reconcileSpeciesCodigoCollision(s: ServerSpecies): Promise<boolean> {
  return enTransaccion(async (tx) => {
    const [dup] = await tx
      .select({ id: species.id })
      .from(species)
      .where(and(eq(species.codigo, s.codigo), ne(species.id, s.id)));
    if (!dup) return false;

    await tx.update(trees).set({ especieId: s.id }).where(eq(trees.especieId, dup.id));
    await tx.update(trees).set({ conflictEspecieId: s.id }).where(eq(trees.conflictEspecieId, dup.id));
    await tx.update(plantationSpecies).set({ especieId: s.id }).where(eq(plantationSpecies.especieId, dup.id));
    // user_species_order tiene UNIQUE(user, plantacion, especie): re-apuntar podría colisionar; es
    // solo orden visual, se borra la referencia vieja.
    await tx.delete(userSpeciesOrder).where(eq(userSpeciesOrder.especieId, dup.id));

    await tx.delete(species).where(eq(species.id, dup.id));
    await upsertSpeciesById(tx, [s]);
    return true;
  });
}

/**
 * Camino rápido: lotes de un statement. Devuelve las filas de los lotes que
 * fallaron —lo esperable es un choque por UNIQUE(codigo)— para rehacerlas una por
 * una (#449).
 */
async function upsertEnLotes(filas: ServerSpecies[]): Promise<ServerSpecies[]> {
  const fallidas: ServerSpecies[] = [];
  for (let i = 0; i < filas.length; i += FILAS_POR_TRANSACCION) {
    abortarSiCancelado();
    const lote = filas.slice(i, i + FILAS_POR_TRANSACCION);
    try {
      await enTransaccion((tx) => upsertSpeciesById(tx, lote));
    } catch (e) {
      // El catch de "seguir ante fallas" no puede tragarse la cancelación (#451).
      relanzarSiEsCancelacion(e);
      fallidas.push(...lote);
    }
  }
  return fallidas;
}

/** Probable choque por UNIQUE(codigo) con una especie local de distinto id. */
async function reconciliarOSaltear(s: ServerSpecies, errorDeUpsert: any): Promise<Guardado> {
  try {
    if (await reconcileSpeciesCodigoCollision(s)) return GUARDADO.reconciled;
    syncLog.error(`Pull species: skipping ${s.id} (codigo=${s.codigo}):`, errorDeUpsert?.message ?? errorDeUpsert);
  } catch (e2: any) {
    syncLog.error(`Pull species: reconcile falló ${s.id} (codigo=${s.codigo}):`, e2?.message ?? e2);
  }
  return GUARDADO.skipped;
}

async function upsertFila(s: ServerSpecies): Promise<Guardado> {
  try {
    await upsertSpeciesById(db, [s]);
    return GUARDADO.upserted;
  } catch (e) {
    relanzarSiEsCancelacion(e);
    return reconciliarOSaltear(s, e);
  }
}

/** Upsertea especies del server; una que falla no aborta el resto. */
async function guardarEspecies(filas: ServerSpecies[]): Promise<ConteoDeGuardado> {
  const porFila = await upsertEnLotes(filas);
  const conteo: ConteoDeGuardado = { upserted: filas.length - porFila.length, reconciled: 0, skipped: 0 };
  for (const s of porFila) {
    abortarSiCancelado();
    conteo[await upsertFila(s)]++;
  }
  return conteo;
}

/** Trae especies de Supabase y las upsertea en SQLite; si falla, retorna en silencio (catálogo stale es aceptable). Solo borra una especie al reconciliar un duplicado por codigo, tras re-apuntar sus referencias. */
export async function pullSpeciesFromServer(): Promise<void> {
  const { data, error } = await fetchAllRows<ServerSpecies>(() =>
    supabase.from('species').select('*')
  );
  if (error || !data) {
    syncLog.error('Pull species: fetchAllRows error:', JSON.stringify(error));
    return;
  }
  const conteo = await guardarEspecies(data);
  syncLog.info(`Pull species: ${conteo.upserted} upserted, ${conteo.reconciled} reconciled, ${conteo.skipped} skipped of ${data.length} total`);
}

async function presentesEnLocal(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await db.select({ id: species.id }).from(species).where(inArray(species.id, ids));
  return new Set(filas.map((f) => f.id));
}

/**
 * Deja en el catálogo local las especies que van a referenciar filas del pull.
 * `pullFromServer` también corre suelto, sin el pull del catálogo (#614): baja por
 * id solo las que falten. Devuelve las disponibles; si el server no devuelve una,
 * el que llama no escribe esas filas y la próxima sync lo reintenta.
 */
export async function asegurarEspecies(ids: (string | null | undefined)[]): Promise<Set<string>> {
  const pedidas = [...new Set(ids)].filter((id): id is string => !!id);
  const locales = await presentesEnLocal(pedidas);
  const faltantes = pedidas.filter((id) => !locales.has(id));
  if (faltantes.length === 0) return locales;

  const { data, error } = await fetchAllRows<ServerSpecies>(() =>
    supabase.from('species').select('*').in('id', faltantes)
  );
  if (error || !data) {
    syncLog.error('Pull species por id: error:', JSON.stringify(error));
    return locales;
  }
  await guardarEspecies(data);
  return presentesEnLocal(pedidas);
}
