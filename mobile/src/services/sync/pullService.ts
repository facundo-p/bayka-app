import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { groups, trees, plantationUsers, plantationSpecies, plantations, species, parcelas } from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isRemoteUri, sqlIsLocalUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';
import { findById as findParcelaById } from '../../repositories/ParcelaRepository';

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

async function upsertParcelaFromServer(remoteParcela: RemoteParcela): Promise<void> {
  await db.insert(parcelas).values({
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
      // Preserve pending_sync if local already had it (memory: state-lifecycle).
      pendingSync: sql`CASE WHEN ${parcelas.pendingSync} = 1 THEN 1 ELSE 0 END`,
    },
  });
}

/**
 * Pulls parcelas from the server and upserts them locally. Returns the list
 * of remote parcela IDs.
 *
 * D-16-19: si una fila local tiene pending_sync=true (cambio local pendiente
 * de subir, sea update o tombstone), NO se sobrescribe — el push subsiguiente
 * gana. Esto evita que un pull pise un tombstone local pendiente.
 */
async function pullParcelas(plantacionId: string): Promise<string[]> {
  const { data: remoteParcelas, error } = await supabase
    .from('parcelas')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (error) {
    syncLog.error('Pull parcelas error:', JSON.stringify(error));
    return [];
  }
  syncLog.info('Pull parcelas:', remoteParcelas?.length ?? 0, 'rows');

  if (!remoteParcelas || remoteParcelas.length === 0) return [];

  for (const remoteParcela of remoteParcelas as RemoteParcela[]) {
    // Skip if local row has pending changes — push will win.
    const local = await findParcelaById(remoteParcela.id, { includeDeleted: true });
    if (local?.pendingSync) {
      syncLog.info(`pullParcelas: skipping ${remoteParcela.id} — local has pending changes`);
      continue;
    }
    await upsertParcelaFromServer(remoteParcela);
  }

  return (remoteParcelas as RemoteParcela[]).map((remoteParcela) => remoteParcela.id);
}

async function pullGroups(plantacionId: string): Promise<string[]> {
  // Plan 16-03: REST call usa el nombre nuevo `groups` (compat shim 012b
  // server-side sigue exponiendo VIEW `subgroups` para APKs viejos, pero el
  // nuevo APK habla directo a groups).
  const { data: remoteGroups, error } = await supabase
    .from('groups')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (error) {
    syncLog.error('Pull groups error:', JSON.stringify(error));
    return [];
  }
  syncLog.info('Pull groups:', remoteGroups?.length ?? 0, 'rows');

  if (!remoteGroups || remoteGroups.length === 0) return [];

  for (const sg of remoteGroups) {
    await db.insert(groups).values({
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
  }

  return remoteGroups.map((sg: any) => sg.id);
}

async function pullPlantationUsers(plantacionId: string): Promise<void> {
  const { data: remotePu, error } = await supabase
    .from('plantation_users')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (error) {
    syncLog.error('Pull plantation_users error:', JSON.stringify(error));
    return;
  }
  syncLog.info('Pull plantation_users:', remotePu?.length ?? 0, 'rows');
  if (!remotePu) return;

  const remoteUserIds = new Set(remotePu.map((pu: any) => pu.user_id));
  const localPu = await db.select().from(plantationUsers)
    .where(eq(plantationUsers.plantationId, plantacionId));

  for (const local of localPu) {
    if (!remoteUserIds.has(local.userId)) {
      await db.delete(plantationUsers).where(
        and(
          eq(plantationUsers.plantationId, plantacionId),
          eq(plantationUsers.userId, local.userId),
        )
      );
    }
  }

  for (const pu of remotePu) {
    await db.insert(plantationUsers).values({
      plantationId: pu.plantation_id,
      userId: pu.user_id,
      rolEnPlantacion: pu.rol_en_plantacion,
      assignedAt: pu.assigned_at,
    }).onConflictDoUpdate({
      target: [plantationUsers.plantationId, plantationUsers.userId],
      set: { rolEnPlantacion: sql`excluded.rol_en_plantacion` },
    });
  }
}

async function pullPlantationSpecies(plantacionId: string): Promise<void> {
  const { data: remotePs, error } = await supabase
    .from('plantation_species')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (error) {
    syncLog.error('Pull plantation_species error:', JSON.stringify(error));
    return;
  }
  syncLog.info('Pull plantation_species:', remotePs?.length ?? 0, 'rows');

  if (!remotePs || remotePs.length === 0) return;

  for (const ps of remotePs) {
    const localId = `ps-${ps.plantation_id}-${ps.species_id}`;
    await db.insert(plantationSpecies).values({
      id: localId,
      plantacionId: ps.plantation_id,
      especieId: ps.species_id,
      ordenVisual: ps.orden_visual,
    }).onConflictDoUpdate({
      target: plantationSpecies.id,
      set: { ordenVisual: sql`excluded.orden_visual` },
    });
  }
}

async function hasTreeConflict(remoteTree: any): Promise<boolean> {
  if (!remoteTree.species_id) return false;

  const [localTree] = await db.select({ especieId: trees.especieId }).from(trees).where(eq(trees.id, remoteTree.id));
  if (!localTree || localTree.especieId === null || localTree.especieId === remoteTree.species_id) return false;

  const [serverSpecies] = await db.select({ nombre: species.nombre }).from(species).where(eq(species.id, remoteTree.species_id));
  await db.update(trees).set({
    conflictEspecieId: remoteTree.species_id,
    conflictEspecieNombre: serverSpecies?.nombre ?? 'Desconocida',
  }).where(eq(trees.id, remoteTree.id));

  syncLog.info(`Conflict detected for tree ${remoteTree.id}: local=${localTree.especieId}, server=${remoteTree.species_id}`);
  return true;
}

async function upsertTreeFromServer(t: any): Promise<void> {
  const hasFotoOnServer = isRemoteUri(t.foto_url);
  const serverFotoUrl = hasFotoOnServer ? t.foto_url : null;
  // Plan 16-03: server schema usa group_id directo (compat shim 012b mantiene
  // subgroup_id como GENERATED column para APKs viejos).
  const groupIdRemote = t.group_id ?? t.subgroup_id;

  await db.insert(trees).values({
    id: t.id,
    groupId: groupIdRemote,
    especieId: t.species_id,
    posicion: t.posicion,
    subId: t.sub_id,
    fotoUrl: serverFotoUrl,
    fotoSynced: hasFotoOnServer,
    plantacionId: null,
    globalId: null,
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
      conflictEspecieId: sql`NULL`,
      conflictEspecieNombre: sql`NULL`,
    },
  });
}

async function pullTrees(remoteGroupIds: string[]): Promise<void> {
  // Plan 16-03: filtro por group_id (nombre nuevo).
  const { data: remoteTrees, error } = await supabase
    .from('trees')
    .select('*')
    .in('group_id', remoteGroupIds);

  if (error) {
    syncLog.error('Pull trees error:', JSON.stringify(error));
    return;
  }
  syncLog.info('Pull trees:', remoteTrees?.length ?? 0, 'rows');

  if (!remoteTrees || remoteTrees.length === 0) return;

  syncLog.info('Sample tree created_at:', remoteTrees[0].created_at, '| localToday:', require('../../utils/dateUtils').localToday());

  for (const t of remoteTrees) {
    if (await hasTreeConflict(t)) continue;
    await upsertTreeFromServer(t);
  }
}

// ─── Pull from server ─────────────────────────────────────────────────────────

/**
 * Downloads plantation metadata, parcelas, groups, plantation_users,
 * plantation_species and trees from Supabase and upserts them into local
 * SQLite.
 *
 * FK ordering (D-16-12): parcelas BEFORE groups (groups.parcela_id FK).
 */
export async function pullFromServer(plantacionId: string): Promise<void> {
  syncLog.info('Pull starting for plantation:', plantacionId);
  await pullPlantationMetadata(plantacionId);
  await pullParcelas(plantacionId);                  // D-16-12: parcelas first
  const remoteGroupIds = await pullGroups(plantacionId);
  await pullPlantationUsers(plantacionId);
  await pullPlantationSpecies(plantacionId);
  if (remoteGroupIds.length > 0) await pullTrees(remoteGroupIds);
}
