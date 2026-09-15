import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { groups, trees, plantationUsers, plantationSpecies, plantations, species, parcelas } from '../../database/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { isRemoteUri, sqlIsLocalUri } from '../../utils/photoUri';
import { syncLog } from '../../utils/syncLogger';
import { PHOTO_CAPTURE_ALL_TREES_DEFAULT } from '../../constants/photoCapture';
import { fetchAllRows } from './paginate';
import { enTransaccion, enTransaccionPorLotes } from '../../database/transaccion';
import { DOWNLOAD_PHASE, PULL_OK, PULL_SIN_ACCESO } from './types';
import type { DownloadPhase, DownloadPhaseProgress, PullResult } from './types';
import { marcandoActividadDeSync } from './syncActivityStore';

export type OnPhaseProgress = (p: DownloadPhaseProgress) => void;

function emitProgress(
  onProgress: OnPhaseProgress | undefined,
  phase: DownloadPhase,
  done: number,
  total: number,
): void {
  onProgress?.({ phase, phaseDone: done, phaseTotal: total });
}

/** Callback de paginación: reporta filas bajadas, con el total todavía desconocido. */
function alBajarPagina(onProgress: OnPhaseProgress | undefined, phase: DownloadPhase) {
  return (filas: number) =>
    onProgress?.({ phase, phaseDone: filas, phaseTotal: 0, descargando: true });
}

// ─── Pull helpers ────────────────────────────────────────────────────────────

/**
 * ¿El server todavía reconoce mi membresía? Es el mismo criterio que las
 * policies de SELECT (`is_plantation_member`), incluidos los admins, que reciben
 * su fila por trigger.
 *
 * Solo devuelve false ante evidencia positiva de revocación: si no hay sesión,
 * si la consulta falla (offline) o si la plantación todavía no se pusheó, se
 * asume acceso y el pull sigue su camino de siempre.
 */
async function tieneAccesoRemoto(plantacionId: string): Promise<boolean> {
  const [local] = await db
    .select({ pendingSync: plantations.pendingSync })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  if (local?.pendingSync) return true;

  const { data: sesion } = await supabase.auth.getSession();
  const userId = sesion?.session?.user?.id;
  if (!userId) return true;

  const { data, error } = await supabase
    .from('plantation_users')
    .select('user_id')
    // (plantation_id, user_id) es la PK: vuelve una fila o ninguna.
    .eq('plantation_id', plantacionId)
    .eq('user_id', userId);
  if (error) {
    syncLog.error('Chequeo de membresía falló:', JSON.stringify(error));
    return true;
  }
  return (data ?? []).length > 0;
}

/** Flags de plantación administrados desde la web (server gana); ausentes en la respuesta (server sin la columna) → default. */
export function webManagedFlags(remote: { visible_in_app?: boolean | null; photo_capture_all_trees?: boolean | null }) {
  return {
    visibleInApp: remote.visible_in_app ?? true,
    photoCaptureAllTrees: remote.photo_capture_all_trees ?? PHOTO_CAPTURE_ALL_TREES_DEFAULT,
  };
}

async function pullPlantationMetadata(plantacionId: string): Promise<void> {
  // select('*') en vez de columnas explícitas: tolera servers sin las columnas nuevas (GPS, visible_in_app) — pedirlas por nombre rompería el pull entero. Los guards != null hacen el resto.
  const { data: remotePlantation, error } = await supabase
    .from('plantations')
    .select('*')
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

  // El snapshot *Server de GPS se refresca siempre; las columnas vivas solo si no hay edición local pendiente. Guard contra servers sin esas columnas.
  if (remotePlantation.gps_capture_frequency != null) {
    serverUpdate.gpsCaptureFrequencyServer = remotePlantation.gps_capture_frequency;
  }
  if (remotePlantation.gps_capture_required != null) {
    serverUpdate.gpsCaptureRequiredServer = remotePlantation.gps_capture_required;
  }

  Object.assign(serverUpdate, webManagedFlags(remotePlantation));

  const [local] = await db
    .select({ pendingEdit: plantations.pendingEdit })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));

  if (!local?.pendingEdit) {
    serverUpdate.lugar = remotePlantation.lugar;
    serverUpdate.periodo = remotePlantation.periodo;
    if (remotePlantation.gps_capture_frequency != null) {
      serverUpdate.gpsCaptureFrequency = remotePlantation.gps_capture_frequency;
    }
    if (remotePlantation.gps_capture_required != null) {
      serverUpdate.gpsCaptureRequired = remotePlantation.gps_capture_required;
    }
  }

  await db.update(plantations).set(serverUpdate).where(eq(plantations.id, plantacionId));
}

// ─── Pull parcelas (BEFORE groups — FK ordering) ────────────────────

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

/** Trae parcelas del server y las upsertea local; si pending_sync=true localmente (cambio o tombstone sin subir), no se sobrescribe — el push subsiguiente gana. */
async function pullParcelas(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<string[]> {
  const { data: remoteParcelas, error } = await fetchAllRows<RemoteParcela>(() =>
    supabase.from('parcelas').select('*').eq('plantation_id', plantacionId),
    alBajarPagina(onProgress, DOWNLOAD_PHASE.parcelas),
  );

  if (error) {
    syncLog.error('Pull parcelas error:', JSON.stringify(error));
    emitProgress(onProgress, DOWNLOAD_PHASE.parcelas, 0, 0);
    return [];
  }

  const all = (remoteParcelas ?? []) as RemoteParcela[];
  syncLog.info('Pull parcelas:', all.length, 'rows');
  emitProgress(onProgress, DOWNLOAD_PHASE.parcelas, 0, all.length);
  if (all.length === 0) return [];

  // Pre-fetch de ids con cambios pendientes: evita una lectura extra por parcela dentro del loop.
  const localRows = await db
    .select({ id: parcelas.id, pendingSync: parcelas.pendingSync })
    .from(parcelas)
    .where(eq(parcelas.plantacionId, plantacionId));
  const pendingLocally = new Set(localRows.filter((r) => r.pendingSync).map((r) => r.id));

  await enTransaccionPorLotes(all, async (tx, lote) => {
      // Local push wins.
      const aEscribir = lote.filter((remoteParcela) => !pendingLocally.has(remoteParcela.id));
      if (aEscribir.length === 0) return;
      await tx.insert(parcelas).values(aEscribir.map((remoteParcela) => ({
        id: remoteParcela.id,
        plantacionId: remoteParcela.plantation_id,
        nombre: remoteParcela.nombre,
        codigo: remoteParcela.codigo,
        descripcion: remoteParcela.descripcion ?? null,
        pendingSync: false,
        createdAt: remoteParcela.created_at,
        updatedAt: remoteParcela.updated_at,
        deletedAt: remoteParcela.deleted_at ?? null,
      }))).onConflictDoUpdate({
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
    },
    (escritas) => emitProgress(onProgress, DOWNLOAD_PHASE.parcelas, escritas, all.length),
  );
  emitProgress(onProgress, DOWNLOAD_PHASE.parcelas, all.length, all.length);

  return all.map((remoteParcela) => remoteParcela.id);
}

async function pullGroups(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<string[]> {
  const { data: remoteGroups, error } = await fetchAllRows<any>(() =>
    supabase.from('groups').select('*').eq('plantation_id', plantacionId),
    alBajarPagina(onProgress, DOWNLOAD_PHASE.groups),
  );

  if (error) {
    syncLog.error('Pull groups error:', JSON.stringify(error));
    emitProgress(onProgress, DOWNLOAD_PHASE.groups, 0, 0);
    return [];
  }
  const all = remoteGroups ?? [];
  syncLog.info('Pull groups:', all.length, 'rows');
  emitProgress(onProgress, DOWNLOAD_PHASE.groups, 0, all.length);
  if (all.length === 0) return [];

  // Pre-fetch de ids con cambios pendientes (igual que pullParcelas): el pull no debe pisar un grupo dirty (p.ej. una transición activa→finalizada sin subir).
  const localRows = await db
    .select({ id: groups.id, pendingSync: groups.pendingSync })
    .from(groups)
    .where(eq(groups.plantacionId, plantacionId));
  const pendingLocally = new Set(localRows.filter((r) => r.pendingSync).map((r) => r.id));

  // #90: parcela obligatoria; el throw aborta el pull y se reporta en la UI de sync
  // (no se degrada insertando null en silencio). Se valida antes de escribir nada:
  // un dato inválido no deja la tabla a medio llenar.
  const sinParcela = all.find((sg: any) => sg.parcela_id == null);
  if (sinParcela) {
    throw new Error(`Grupo ${sinParcela.id} sin parcela en el server: dato inválido (#90).`);
  }

  await enTransaccionPorLotes(all, async (tx, lote) => {
      // Local push wins.
      const aEscribir = lote.filter((sg: any) => !pendingLocally.has(sg.id));
      if (aEscribir.length === 0) return;
      await tx.insert(groups).values(aEscribir.map((sg: any) => ({
        id: sg.id,
        plantacionId: sg.plantation_id,
        parcelaId: sg.parcela_id,
        nombre: sg.nombre,
        codigo: sg.codigo,
        tipo: sg.tipo,
        estado: sg.estado,
        usuarioCreador: sg.usuario_creador,
        createdAt: sg.created_at,
        pendingSync: false,
      }))).onConflictDoUpdate({
        target: groups.id,
        set: {
          parcelaId: sql`excluded.parcela_id`,
          estado: sql`excluded.estado`,
          nombre: sql`excluded.nombre`,
        },
      });
    },
    (escritas) => emitProgress(onProgress, DOWNLOAD_PHASE.groups, escritas, all.length),
  );
  emitProgress(onProgress, DOWNLOAD_PHASE.groups, all.length, all.length);

  return all.map((sg: any) => sg.id);
}

async function pullPlantationUsers(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  // Plantación offline sin pushear aún: el server no tiene filas y el replace destructivo borraría la membresía local del creador (#67); recién es autoridad si la plantación ya existe allá.
  const [localPlant] = await db
    .select({ pendingSync: plantations.pendingSync })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  if (localPlant?.pendingSync) {
    syncLog.info('Pull plantation_users: plantación pendiente de push, se omite el replace');
    emitProgress(onProgress, DOWNLOAD_PHASE.usuarios, 0, 0);
    return;
  }

  const { data: remotePu, error } = await fetchAllRows<any>(() =>
    supabase.from('plantation_users').select('*').eq('plantation_id', plantacionId),
    alBajarPagina(onProgress, DOWNLOAD_PHASE.usuarios),
  );

  if (error) {
    syncLog.error('Pull plantation_users error:', JSON.stringify(error));
    emitProgress(onProgress, DOWNLOAD_PHASE.usuarios, 0, 0);
    return;
  }
  const all = remotePu ?? [];
  syncLog.info('Pull plantation_users:', all.length, 'rows');
  emitProgress(onProgress, DOWNLOAD_PHASE.usuarios, 0, all.length);

  const remoteUserIds = new Set(all.map((pu: any) => pu.user_id));
  const localPu = await db.select().from(plantationUsers)
    .where(eq(plantationUsers.plantationId, plantacionId));

  const revocados = localPu.filter((local) => !remoteUserIds.has(local.userId)).map((local) => local.userId);

  // Los miembros de una plantación son pocos: el replace entero entra en una
  // transacción, con un statement por lado.
  await enTransaccion(async (tx) => {
    if (revocados.length > 0) {
      await tx.delete(plantationUsers).where(
        and(
          eq(plantationUsers.plantationId, plantacionId),
          inArray(plantationUsers.userId, revocados),
        )
      );
    }
    if (all.length === 0) return;
    await tx.insert(plantationUsers).values(all.map((pu: any) => ({
      plantationId: pu.plantation_id,
      userId: pu.user_id,
      rolEnPlantacion: pu.rol_en_plantacion,
      assignedAt: pu.assigned_at,
    }))).onConflictDoUpdate({
      target: [plantationUsers.plantationId, plantationUsers.userId],
      set: { rolEnPlantacion: sql`excluded.rol_en_plantacion` },
    });
  });
  emitProgress(onProgress, DOWNLOAD_PHASE.usuarios, all.length, all.length);
}

async function pullPlantationSpecies(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  const { data: remotePs, error } = await fetchAllRows<any>(() =>
    supabase.from('plantation_species').select('*').eq('plantation_id', plantacionId),
    alBajarPagina(onProgress, DOWNLOAD_PHASE.especiesPlantacion),
  );

  if (error) {
    syncLog.error('Pull plantation_species error:', JSON.stringify(error));
    emitProgress(onProgress, DOWNLOAD_PHASE.especiesPlantacion, 0, 0);
    return;
  }
  const all = remotePs ?? [];
  syncLog.info('Pull plantation_species:', all.length, 'rows');
  emitProgress(onProgress, DOWNLOAD_PHASE.especiesPlantacion, 0, all.length);
  if (all.length === 0) return;

  await enTransaccionPorLotes(all, async (tx, lote) => {
      await tx.insert(plantationSpecies).values(lote.map((ps: any) => ({
        id: `ps-${ps.plantation_id}-${ps.species_id}`,
        plantacionId: ps.plantation_id,
        especieId: ps.species_id,
        ordenVisual: ps.orden_visual,
      }))).onConflictDoUpdate({
        target: plantationSpecies.id,
        set: { ordenVisual: sql`excluded.orden_visual` },
      });
    },
    (escritas) => emitProgress(onProgress, DOWNLOAD_PHASE.especiesPlantacion, escritas, all.length),
  );
  emitProgress(onProgress, DOWNLOAD_PHASE.especiesPlantacion, all.length, all.length);
}

type Tx = any; // Drizzle tx type or full db when transactions unsupported (test mocks).

/** Árbol del server en columnas locales. Las filas de un lote comparten forma: el `set` del upsert es uno solo para todas y se resuelve con `excluded`. */
function filaDeArbol(t: any) {
  const hasFotoOnServer = isRemoteUri(t.foto_url);
  return {
    id: t.id,
    // El server usa group_id directo; el compat shim 012b mantiene subgroup_id como GENERATED column para APKs viejos.
    groupId: t.group_id ?? t.subgroup_id,
    especieId: t.species_id,
    posicion: t.posicion,
    subId: t.sub_id,
    fotoUrl: hasFotoOnServer ? t.foto_url : null,
    fotoSynced: hasFotoOnServer,
    plantacionId: t.plantacion_id ?? null,
    globalId: t.global_id ?? null,
    usuarioRegistro: t.usuario_registro,
    createdAt: t.created_at,
    latitude: t.latitude ?? null,
    longitude: t.longitude ?? null,
    gpsAccuracy: t.gps_accuracy ?? null,
    gpsCapturedAt: t.gps_captured_at ?? null,
  };
}

/** Upsert de un lote de árboles del server en un solo statement. */
export async function upsertTreesFromServerTx(tx: Tx, remotos: any[]): Promise<void> {
  if (remotos.length === 0) return;

  await tx.insert(trees).values(remotos.map(filaDeArbol)).onConflictDoUpdate({
    target: trees.id,
    set: {
      especieId: sql`CASE WHEN ${trees.especieId} IS NOT NULL THEN ${trees.especieId} ELSE excluded.especie_id END`,
      posicion: sql`excluded.posicion`,
      subId: sql`CASE WHEN ${trees.especieId} IS NOT NULL THEN ${trees.subId} ELSE excluded.sub_id END`,
      fotoUrl: sql`CASE WHEN ${sqlIsLocalUri(trees.fotoUrl)} THEN ${trees.fotoUrl} ELSE excluded.foto_url END`,
      // `excluded.foto_synced` es el "hay foto en el server" de ESA fila: con un
      // insert multi-fila la condición viaja en los valores, no en el `set`.
      fotoSynced: sql`CASE WHEN excluded.foto_synced = 1 THEN 1 ELSE ${trees.fotoSynced} END`,
      // IDs definitivos: conserva el local si ya existe (generado, no pusheado aún); adopta el del server si el local está vacío. Nunca pisa con NULL.
      plantacionId: sql`CASE WHEN ${trees.plantacionId} IS NOT NULL THEN ${trees.plantacionId} ELSE excluded.plantacion_id END`,
      globalId: sql`CASE WHEN ${trees.globalId} IS NOT NULL THEN ${trees.globalId} ELSE excluded.global_id END`,
      // Punto GPS: el local no-null gana (captura pendiente de push); se adopta el del server solo si no hay punto local. Las 4 columnas se deciden juntas por latitude, para no mezclar fixes.
      latitude: sql`CASE WHEN ${trees.latitude} IS NOT NULL THEN ${trees.latitude} ELSE excluded.latitude END`,
      longitude: sql`CASE WHEN ${trees.latitude} IS NOT NULL THEN ${trees.longitude} ELSE excluded.longitude END`,
      gpsAccuracy: sql`CASE WHEN ${trees.latitude} IS NOT NULL THEN ${trees.gpsAccuracy} ELSE excluded.gps_accuracy END`,
      gpsCapturedAt: sql`CASE WHEN ${trees.latitude} IS NOT NULL THEN ${trees.gpsCapturedAt} ELSE excluded.gps_captured_at END`,
      conflictEspecieId: sql`NULL`,
      conflictEspecieNombre: sql`NULL`,
    },
  });
}

/** Nombre a mostrar cuando el server manda una especie que el catálogo local todavía no tiene. */
const ESPECIE_DESCONOCIDA = 'Desconocida';

/** Árbol del server cuya fila local ya tiene otra especie asignada: lo resuelve el usuario, no el pull. */
type ConflictoDeEspecie = { remoto: any; especieLocal: string };

/** `especieLocal` null o undefined = la fila local no existe o no tiene especie: no hay con qué chocar. */
function esConflictoDeEspecie(
  candidato: { remoto: any; especieLocal: string | null | undefined },
): candidato is ConflictoDeEspecie {
  if (!candidato.remoto.species_id) return false;
  if (candidato.especieLocal == null) return false;
  return candidato.especieLocal !== candidato.remoto.species_id;
}

/**
 * Marca los árboles en conflicto con `conflictEspecieId` para que la UI prompte.
 * El remoto de esas filas no se upsertea: lo decide el usuario.
 */
async function marcarConflictosDeEspecie(conflictivos: ConflictoDeEspecie[]): Promise<Set<string>> {
  if (conflictivos.length === 0) return new Set();

  // Un solo select de nombres para todos los conflictos, en vez de uno por árbol.
  const idsDeEspecie = [...new Set(conflictivos.map(({ remoto }) => remoto.species_id as string))];
  const filas = await db.select({ id: species.id, nombre: species.nombre }).from(species)
    .where(inArray(species.id, idsDeEspecie));
  const nombrePorEspecie = new Map(filas.map((e) => [e.id, e.nombre]));

  await enTransaccionPorLotes(conflictivos, async (tx, lote) => {
    for (const { remoto } of lote) {
      await tx.update(trees).set({
        conflictEspecieId: remoto.species_id,
        conflictEspecieNombre: nombrePorEspecie.get(remoto.species_id) ?? ESPECIE_DESCONOCIDA,
      }).where(eq(trees.id, remoto.id));
    }
  });

  for (const { remoto, especieLocal } of conflictivos) {
    syncLog.info(`Conflict detected for tree ${remoto.id}: local=${especieLocal}, server=${remoto.species_id}`);
  }
  return new Set(conflictivos.map(({ remoto }) => remoto.id as string));
}

/**
 * Especie local de cada árbol de esos grupos, en una sola lectura (#449): antes
 * el chequeo de conflicto costaba dos selects por árbol. Alcanza con filtrar por
 * grupo porque un árbol nunca cambia de grupo — ni el alta ni el upsert del pull
 * tocan `group_id` después de crearlo.
 */
async function especiePorArbolLocal(remoteGroupIds: string[]): Promise<Map<string, string | null>> {
  const locales = await db
    .select({ id: trees.id, especieId: trees.especieId })
    .from(trees)
    .where(inArray(trees.groupId, remoteGroupIds));
  return new Map(locales.map((t) => [t.id, t.especieId]));
}

async function pullTrees(
  remoteGroupIds: string[],
  onProgress?: OnPhaseProgress,
): Promise<void> {
  const { data: remoteTrees, error } = await fetchAllRows<any>(() =>
    supabase.from('trees').select('*').in('group_id', remoteGroupIds),
    alBajarPagina(onProgress, DOWNLOAD_PHASE.arboles),
  );

  if (error) {
    syncLog.error('Pull trees error:', JSON.stringify(error));
    emitProgress(onProgress, DOWNLOAD_PHASE.arboles, 0, 0);
    return;
  }
  const all = remoteTrees ?? [];
  syncLog.info('Pull trees:', all.length, 'rows');
  emitProgress(onProgress, DOWNLOAD_PHASE.arboles, 0, all.length);
  if (all.length === 0) return;

  const especieLocal = await especiePorArbolLocal(remoteGroupIds);
  // Descarga fresh: sin filas locales no hay nada con qué chocar.
  if (especieLocal.size === 0) syncLog.info('Pull trees: fresh download — sin árboles locales');

  const conflictivos = all
    .map((remoto: any) => ({ remoto, especieLocal: especieLocal.get(remoto.id) }))
    .filter(esConflictoDeEspecie);
  const enConflicto = await marcarConflictosDeEspecie(conflictivos);

  await enTransaccionPorLotes(all, async (tx, lote) => {
      await upsertTreesFromServerTx(tx, lote.filter((t: any) => !enConflicto.has(t.id)));
    },
    (escritas) => emitProgress(onProgress, DOWNLOAD_PHASE.arboles, escritas, all.length),
  );
  emitProgress(onProgress, DOWNLOAD_PHASE.arboles, all.length, all.length);
}

/**
 * Duración de cada fase. Es la única forma de medir en device si un cambio en la
 * escritura sirvió: jest no corre expo-sqlite, así que el número real solo aparece
 * en el log de la app (#448).
 */
async function conDuracion<T>(fase: DownloadPhase, tarea: () => Promise<T>): Promise<T> {
  const inicio = Date.now();
  try {
    return await tarea();
  } finally {
    syncLog.info(`Pull fase ${fase}: ${Date.now() - inicio}ms`);
  }
}

// ─── Pull from server ─────────────────────────────────────────────────────────

/** Descarga plantación/parcelas/groups/usuarios/especies/árboles del server y los upsertea en SQLite; parcelas van antes que groups por FK.
 *  Corta antes de tocar la base si la membresía fue revocada: la copia local se conserva tal cual. */
async function correrPullFromServer(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<PullResult> {
  if (!(await tieneAccesoRemoto(plantacionId))) {
    syncLog.info('Pull abortado: sin membresía en la plantación', plantacionId);
    return PULL_SIN_ACCESO;
  }
  syncLog.info('Pull starting for plantation:', plantacionId);
  const inicio = Date.now();
  // La metadata es un solo UPDATE: no hay nada que medir ahí.
  await pullPlantationMetadata(plantacionId);
  await conDuracion(DOWNLOAD_PHASE.parcelas, () => pullParcelas(plantacionId, onProgress));
  const remoteGroupIds = await conDuracion(DOWNLOAD_PHASE.groups, () => pullGroups(plantacionId, onProgress));
  await conDuracion(DOWNLOAD_PHASE.usuarios, () => pullPlantationUsers(plantacionId, onProgress));
  await conDuracion(DOWNLOAD_PHASE.especiesPlantacion, () => pullPlantationSpecies(plantacionId, onProgress));
  if (remoteGroupIds.length > 0) {
    await conDuracion(DOWNLOAD_PHASE.arboles, () => pullTrees(remoteGroupIds, onProgress));
  }
  syncLog.info(`Pull total: ${Date.now() - inicio}ms`);
  return PULL_OK;
}

// El pull-to-refresh de plantaciones lo llama suelto, sin pasar por un orquestador,
// y escribe la base igual (#446). Anidado dentro de una sync el contador lo absorbe.
export const pullFromServer = marcandoActividadDeSync(correrPullFromServer);
