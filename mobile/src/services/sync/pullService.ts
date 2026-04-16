import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { subgroups, trees, plantationUsers, plantationSpecies, plantations, species } from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { isRemoteUri, sqlIsLocalUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';

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

async function pullSubgroups(plantacionId: string): Promise<string[]> {
  const { data: remoteSubgroups, error } = await supabase
    .from('subgroups')
    .select('*')
    .eq('plantation_id', plantacionId);

  if (error) {
    syncLog.error('Pull subgroups error:', JSON.stringify(error));
    return [];
  }
  syncLog.info('Pull subgroups:', remoteSubgroups?.length ?? 0, 'rows');

  if (!remoteSubgroups || remoteSubgroups.length === 0) return [];

  for (const sg of remoteSubgroups) {
    await db.insert(subgroups).values({
      id: sg.id,
      plantacionId: sg.plantation_id,
      nombre: sg.nombre,
      codigo: sg.codigo,
      tipo: sg.tipo,
      estado: sg.estado,
      usuarioCreador: sg.usuario_creador,
      createdAt: sg.created_at,
      pendingSync: false,
    }).onConflictDoUpdate({
      target: subgroups.id,
      set: {
        estado: sql`excluded.estado`,
        nombre: sql`excluded.nombre`,
        pendingSync: sql`CASE WHEN ${subgroups.pendingSync} = 1 THEN 1 ELSE 0 END`,
      },
    });
  }

  return remoteSubgroups.map((sg: any) => sg.id);
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

  await db.insert(trees).values({
    id: t.id,
    subgrupoId: t.subgroup_id,
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

async function pullTrees(remoteSubgroupIds: string[]): Promise<void> {
  const { data: remoteTrees, error } = await supabase
    .from('trees')
    .select('*')
    .in('subgroup_id', remoteSubgroupIds);

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
 * Downloads plantation metadata, subgroups, plantation_users, plantation_species
 * and trees from Supabase and upserts them into local SQLite.
 */
export async function pullFromServer(plantacionId: string): Promise<void> {
  syncLog.info('Pull starting for plantation:', plantacionId);
  await pullPlantationMetadata(plantacionId);
  const remoteSubgroupIds = await pullSubgroups(plantacionId);
  await pullPlantationUsers(plantacionId);
  await pullPlantationSpecies(plantacionId);
  if (remoteSubgroupIds.length > 0) await pullTrees(remoteSubgroupIds);
}
