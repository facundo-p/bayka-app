import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { groups, trees, plantationUsers, plantationSpecies, plantations, species, parcelas } from '../../database/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { isRemoteUri, sqlIsLocalUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';
import { fetchAllRows, runInTransaction } from './paginate';
import type { DownloadPhase, DownloadPhaseProgress } from './types';

export type OnPhaseProgress = (p: DownloadPhaseProgress) => void;

/**
 * Emits progress every PROGRESS_EVERY rows to avoid React state churn on
 * large pulls (a 7000-row tree pull would otherwise dispatch 7000 setState).
 */
const PROGRESS_EVERY = 100;

function emitProgress(
  onProgress: OnPhaseProgress | undefined,
  phase: DownloadPhase,
  done: number,
  total: number,
): void {
  onProgress?.({ phase, phaseDone: done, phaseTotal: total });
}

// ─── Pull helpers ────────────────────────────────────────────────────────────

async function pullPlantationMetadata(plantacionId: string): Promise<void> {
  const { data: remotePlantation, error } = await supabase
    .from('plantations')
    .select('lugar, periodo, estado')
    .eq('id', plantacionId)
    .single();

  if (error) {
    syncLog.error('Pull plantation metadata error:', JSON.stringify(error));
    return;
  }
  if (!remotePlantation) return;

  const serverUpdate: Record<string, any> = {
    lugarServer: remotePlantation.lugar,
    periodoServer: remotePlantation.periodo,
    estado: remotePlantation.estado,
  };

  const [local] = await db
    .select({ pendingEdit: plantations.pendingEdit })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));

  if (!local?.pendingEdit) {
    serverUpdate.lugar = remotePlantation.lugar;
    serverUpdate.periodo = remotePlantation.periodo;
  }

  await db.update(plantations).set(serverUpdate).where(eq(plantations.id, plantacionId));
}

// ─── Pull parcelas (BEFORE groups — D-16-12, FK ordering) ────────────────────

interface RemoteParcela {
  id: string;
  plantation_id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Pulls parcelas from the server and upserts them locally. Returns the list
 * of remote parcela IDs.
 *
 * Si una fila local tiene pending_sync=true (cambio local pendiente de subir,
 * sea update o tombstone), NO se sobrescribe — el push subsiguiente gana.
 * Esto evita que un pull pise un tombstone local pendiente.
 */
async function pullParcelas(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<string[]> {
  const { data: remoteParcelas, error } = await fetchAllRows<RemoteParcela>(() =>
    supabase.from('parcelas').select('*').eq('plantation_id', plantacionId)
  );

  if (error) {
    syncLog.error('Pull parcelas error:', JSON.stringify(error));
    emitProgress(onProgress, 'parcelas', 0, 0);
    return [];
  }

  const all = (remoteParcelas ?? []) as RemoteParcela[];
  syncLog.info('Pull parcelas:', all.length, 'rows');
  emitProgress(onProgress, 'parcelas', 0, all.length);
  if (all.length === 0) return [];

  // Pre-fetch ids that have local pending changes to skip in one query
  // (avoids one extra read per parcela inside the loop).
  const localRows = await db
    .select({ id: parcelas.id, pendingSync: parcelas.pendingSync })
    .from(parcelas)
    .where(eq(parcelas.plantacionId, plantacionId));
  const pendingLocally = new Set(localRows.filter((r) => r.pendingSync).map((r) => r.id));

  await runInTransaction(db, async (tx: any) => {
    let done = 0;
    for (const remoteParcela of all) {
      if (pendingLocally.has(remoteParcela.id)) {
        // Local push wins — skip overwriting pending changes.
        done++;
        continue;
      }
      await tx.insert(parcelas).values({
        id: remoteParcela.id,
        plantacionId: remoteParcela.plantation_id,
        nombre: remoteParcela.nombre,
        codigo: remoteParcela.codigo,
        descripcion: remoteParcela.descripcion ?? null,
        pendingSync: false,
        createdAt: remoteParcela.created_at,
        updatedAt: remoteParcela.updated_at,
        deletedAt: remoteParcela.deleted_at ?? null,
      }).onConflictDoUpdate({
        target: parcelas.id,
        set: {
          nombre: sql`excluded.nombre`,
          codigo: sql`excluded.codigo`,
          descripcion: sql`excluded.descripcion`,
          updatedAt: sql`excluded.updated_at`,
          deletedAt: sql`excluded.deleted_at`,
          pendingSync: sql`CASE WHEN ${parcelas.pendingSync} = 1 THEN 1 ELSE 0 END`,
        },
      });
      done++;
      if (done % PROGRESS_EVERY === 0) emitProgress(onProgress, 'parcelas', done, all.length);
    }
  });
  emitProgress(onProgress, 'parcelas', all.length, all.length);

  return all.map((remoteParcela) => remoteParcela.id);
}

async function pullGroups(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<string[]> {
  const { data: remoteGroups, error } = await fetchAllRows<any>(() =>
    supabase.from('groups').select('*').eq('plantation_id', plantacionId)
  );

  if (error) {
    syncLog.error('Pull groups error:', JSON.stringify(error));
    emitProgress(onProgress, 'groups', 0, 0);
    return [];
  }
  const all = remoteGroups ?? [];
  syncLog.info('Pull groups:', all.length, 'rows');
  emitProgress(onProgress, 'groups', 0, all.length);
  if (all.length === 0) return [];

  await runInTransaction(db, async (tx: any) => {
    let done = 0;
    for (const sg of all) {
      await tx.insert(groups).values({
        id: sg.id,
        plantacionId: sg.plantation_id,
        parcelaId: sg.parcela_id ?? null,
        nombre: sg.nombre,
        codigo: sg.codigo,
        tipo: sg.tipo,
        estado: sg.estado,
        usuarioCreador: sg.usuario_creador,
        createdAt: sg.created_at,
        pendingSync: false,
      }).onConflictDoUpdate({
        target: groups.id,
        set: {
          parcelaId: sql`excluded.parcela_id`,
          estado: sql`excluded.estado`,
          nombre: sql`excluded.nombre`,
          pendingSync: sql`CASE WHEN ${groups.pendingSync} = 1 THEN 1 ELSE 0 END`,
        },
      });
      done++;
      if (done % PROGRESS_EVERY === 0) emitProgress(onProgress, 'groups', done, all.length);
    }
  });
  emitProgress(onProgress, 'groups', all.length, all.length);

  return all.map((sg: any) => sg.id);
}

async function pullPlantationUsers(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  const { data: remotePu, error } = await fetchAllRows<any>(() =>
    supabase.from('plantation_users').select('*').eq('plantation_id', plantacionId)
  );

  if (error) {
    syncLog.error('Pull plantation_users error:', JSON.stringify(error));
    emitProgress(onProgress, 'usuarios', 0, 0);
    return;
  }
  const all = remotePu ?? [];
  syncLog.info('Pull plantation_users:', all.length, 'rows');
  emitProgress(onProgress, 'usuarios', 0, all.length);

  const remoteUserIds = new Set(all.map((pu: any) => pu.user_id));
  const localPu = await db.select().from(plantationUsers)
    .where(eq(plantationUsers.plantationId, plantacionId));

  await runInTransaction(db, async (tx: any) => {
    for (const local of localPu) {
      if (!remoteUserIds.has(local.userId)) {
        await tx.delete(plantationUsers).where(
          and(
            eq(plantationUsers.plantationId, plantacionId),
            eq(plantationUsers.userId, local.userId),
          )
        );
      }
    }

    let done = 0;
    for (const pu of all) {
      await tx.insert(plantationUsers).values({
        plantationId: pu.plantation_id,
        userId: pu.user_id,
        rolEnPlantacion: pu.rol_en_plantacion,
        assignedAt: pu.assigned_at,
      }).onConflictDoUpdate({
        target: [plantationUsers.plantationId, plantationUsers.userId],
        set: { rolEnPlantacion: sql`excluded.rol_en_plantacion` },
      });
      done++;
      if (done % PROGRESS_EVERY === 0) emitProgress(onProgress, 'usuarios', done, all.length);
    }
  });
  emitProgress(onProgress, 'usuarios', all.length, all.length);
}

async function pullPlantationSpecies(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  const { data: remotePs, error } = await fetchAllRows<any>(() =>
    supabase.from('plantation_species').select('*').eq('plantation_id', plantacionId)
  );

  if (error) {
    syncLog.error('Pull plantation_species error:', JSON.stringify(error));
    emitProgress(onProgress, 'especies_plantacion', 0, 0);
    return;
  }
  const all = remotePs ?? [];
  syncLog.info('Pull plantation_species:', all.length, 'rows');
  emitProgress(onProgress, 'especies_plantacion', 0, all.length);
  if (all.length === 0) return;

  await runInTransaction(db, async (tx: any) => {
    let done = 0;
    for (const ps of all) {
      const localId = `ps-${ps.plantation_id}-${ps.species_id}`;
      await tx.insert(plantationSpecies).values({
        id: localId,
        plantacionId: ps.plantation_id,
        especieId: ps.species_id,
        ordenVisual: ps.orden_visual,
      }).onConflictDoUpdate({
        target: plantationSpecies.id,
        set: { ordenVisual: sql`excluded.orden_visual` },
      });
      done++;
      if (done % PROGRESS_EVERY === 0) emitProgress(onProgress, 'especies_plantacion', done, all.length);
    }
  });
  emitProgress(onProgress, 'especies_plantacion', all.length, all.length);
}

type Tx = any; // Drizzle tx type or full db when transactions unsupported (test mocks).

/**
 * Per-tree species conflict check: only runs when the row exists locally with
 * a non-null especieId that differs from the server's. Marks the row with
 * conflictEspecieId so the UI can prompt the user.
 *
 * Returns true if the remote tree must NOT be upserted (conflict captured).
 */
async function checkTreeConflict(tx: Tx, remoteTree: any): Promise<boolean> {
  if (!remoteTree.species_id) return false;

  const [localTree] = await tx.select({ especieId: trees.especieId }).from(trees).where(eq(trees.id, remoteTree.id));
  if (!localTree || localTree.especieId === null || localTree.especieId === remoteTree.species_id) return false;

  const [serverSpecies] = await tx.select({ nombre: species.nombre }).from(species).where(eq(species.id, remoteTree.species_id));
  await tx.update(trees).set({
    conflictEspecieId: remoteTree.species_id,
    conflictEspecieNombre: serverSpecies?.nombre ?? 'Desconocida',
  }).where(eq(trees.id, remoteTree.id));

  syncLog.info(`Conflict detected for tree ${remoteTree.id}: local=${localTree.especieId}, server=${remoteTree.species_id}`);
  return true;
}

export async function upsertTreeFromServerTx(tx: Tx, t: any): Promise<void> {
  const hasFotoOnServer = isRemoteUri(t.foto_url);
  const serverFotoUrl = hasFotoOnServer ? t.foto_url : null;
  // Server schema usa group_id directo; el compat shim 012b mantiene subgroup_id
  // como GENERATED column para APKs viejos.
  const groupIdRemote = t.group_id ?? t.subgroup_id;

  await tx.insert(trees).values({
    id: t.id,
    groupId: groupIdRemote,
    especieId: t.species_id,
    posicion: t.posicion,
    subId: t.sub_id,
    fotoUrl: serverFotoUrl,
    fotoSynced: hasFotoOnServer,
    plantacionId: t.plantacion_id ?? null,
    globalId: t.global_id ?? null,
    usuarioRegistro: t.usuario_registro,
    createdAt: t.created_at,
  }).onConflictDoUpdate({
    target: trees.id,
    set: {
      especieId: sql`CASE WHEN ${trees.especieId} IS NOT NULL THEN ${trees.especieId} ELSE excluded.especie_id END`,
      posicion: sql`excluded.posicion`,
      subId: sql`CASE WHEN ${trees.especieId} IS NOT NULL THEN ${trees.subId} ELSE excluded.sub_id END`,
      fotoUrl: sql`CASE WHEN ${sqlIsLocalUri(trees.fotoUrl)} THEN ${trees.fotoUrl} ELSE excluded.foto_url END`,
      fotoSynced: hasFotoOnServer ? sql`1` : sql`${trees.fotoSynced}`,
      // IDs definitivos: conservar el local si ya existe (generado y aún no pusheado),
      // adoptar el del server cuando el local está vacío. Nunca pisar con NULL.
      plantacionId: sql`CASE WHEN ${trees.plantacionId} IS NOT NULL THEN ${trees.plantacionId} ELSE excluded.plantacion_id END`,
      globalId: sql`CASE WHEN ${trees.globalId} IS NOT NULL THEN ${trees.globalId} ELSE excluded.global_id END`,
      conflictEspecieId: sql`NULL`,
      conflictEspecieNombre: sql`NULL`,
    },
  });
}

async function pullTrees(
  remoteGroupIds: string[],
  onProgress?: OnPhaseProgress,
): Promise<void> {
  const { data: remoteTrees, error } = await fetchAllRows<any>(() =>
    supabase.from('trees').select('*').in('group_id', remoteGroupIds)
  );

  if (error) {
    syncLog.error('Pull trees error:', JSON.stringify(error));
    emitProgress(onProgress, 'arboles', 0, 0);
    return;
  }
  const all = remoteTrees ?? [];
  syncLog.info('Pull trees:', all.length, 'rows');
  emitProgress(onProgress, 'arboles', 0, all.length);
  if (all.length === 0) return;

  // Fast path: if no local trees exist for these groups (fresh download), we
  // can skip the per-row conflict check entirely. Saves 2 reads × N trees.
  const [localCountRow] = await db
    .select({ cnt: count() })
    .from(trees)
    .where(sql`${trees.groupId} IN (${sql.join(remoteGroupIds.map((id) => sql`${id}`), sql`,`)})`);
  const isFreshDownload = (localCountRow?.cnt ?? 0) === 0;
  if (isFreshDownload) syncLog.info('Pull trees: fresh download — skipping per-tree conflict checks');

  await runInTransaction(db, async (tx: any) => {
    let done = 0;
    for (const t of all) {
      if (!isFreshDownload && await checkTreeConflict(tx, t)) {
        done++;
        continue;
      }
      await upsertTreeFromServerTx(tx, t);
      done++;
      if (done % PROGRESS_EVERY === 0) emitProgress(onProgress, 'arboles', done, all.length);
    }
  });
  emitProgress(onProgress, 'arboles', all.length, all.length);
}

// ─── Pull from server ─────────────────────────────────────────────────────────

/**
 * Downloads plantation metadata, parcelas, groups, plantation_users,
 * plantation_species and trees from Supabase and upserts them into local
 * SQLite.
 *
 * FK ordering: parcelas BEFORE groups (groups.parcela_id FK).
 */
export async function pullFromServer(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  syncLog.info('Pull starting for plantation:', plantacionId);
  await pullPlantationMetadata(plantacionId);
  await pullParcelas(plantacionId, onProgress);
  const remoteGroupIds = await pullGroups(plantacionId, onProgress);
  await pullPlantationUsers(plantacionId, onProgress);
  await pullPlantationSpecies(plantacionId, onProgress);
  if (remoteGroupIds.length > 0) await pullTrees(remoteGroupIds, onProgress);
}
