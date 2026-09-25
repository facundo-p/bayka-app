/**
 * PlantationRepository — mutaciones admin: escriben a Supabase primero, sincronizan a SQLite después.
 * IDs finales (plantacion_id/global_id) los genera el server (RPC generate_tree_ids, #232) y llegan vía pull.
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { plantations, parcelas, trees, groups, plantationSpecies, plantationUsers, userSpeciesOrder, borradosPendientes } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import { pullFromServer } from '../services/SyncService';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { isNetworkRequestFailed } from '../utils/networkErrors';
import { syncLog } from '../utils/syncLogger';
import { ROL } from '../constants/roles';
import { ESTADO_PLANTACION, type EstadoPlantacion } from '../constants/estados';
import {
  escribirSiEsEscribible,
  motivoNoEscribible,
  PlantacionNoEscribibleError,
  BLOQUEAN_ESPECIES,
  BLOQUEAN_ASIGNACIONES,
} from '../services/PlantacionEscribibleService';
import { sinFilasAfectadas } from '../services/sync/filasAfectadas';
import { reemplazarConfiguracion, RPC_REEMPLAZAR_ESPECIES, RPC_REEMPLAZAR_TECNICOS } from '../services/ReemplazoConfiguracionService';
import { getResumenDePendientes, type ResumenDePendientes } from '../queries/catalogQueries';
import { tienePendientes } from '../utils/finalizarPlantacion';
import { getLocalPhotoUrisForPlantation } from './TreeRepository';
import { borrarFotosLocales } from '../services/PhotoService';
import { plantationSpeciesId } from '../utils/plantationSpeciesId';
import {
  aColumnasRemotas,
  aSnapshot,
  cambiosParaElServer,
  hayCambios,
  restaurarDesdeSnapshot,
  snapshotAntesDeEditar,
  type AjustesDePlantacion,
  type CamposDePlantacion,
} from '../utils/camposDePlantacion';

// ─── Membresía local del creador ─────────────────────────────────────────────

/** Inserta localmente la membresía admin del creador (#67); el server la completa vía trigger, pero esta fila da consistencia inmediata offline hasta el próximo pull. */
async function upsertLocalAdminMembership(plantacionId: string, userId: string): Promise<void> {
  await db
    .insert(plantationUsers)
    .values({
      plantationId: plantacionId,
      userId,
      rolEnPlantacion: ROL.admin,
      assignedAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}

export type { AjustesDePlantacion } from '../utils/camposDePlantacion';

// ─── createPlantationLocally ──────────────────────────────────────────────────

/** Crea la plantación solo en SQLite local (pendingSync=true, sin llamar a Supabase) — los grupos pueden referenciarla por FK de inmediato. */
export async function createPlantationLocally(
  lugar: string,
  periodo: string,
  organizacionId: string,
  creadoPor: string,
  ajustes?: Partial<AjustesDePlantacion>
): Promise<{ id: string; lugar: string; periodo: string; estado: string }> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(plantations).values({
    id,
    organizacionId,
    lugar,
    periodo,
    estado: ESTADO_PLANTACION.activa,
    creadoPor,
    createdAt: now,
    pendingSync: true,
    ...(ajustes ?? {}),
  });
  await upsertLocalAdminMembership(id, creadoPor);
  notifyDataChanged();
  return { id, lugar, periodo, estado: ESTADO_PLANTACION.activa };
}

// ─── updatePlantation ─────────────────────────────────────────────────────────

async function filaDePlantacion(plantacionId: string) {
  const [row] = await db.select().from(plantations).where(eq(plantations.id, plantacionId));
  if (!row) throw new Error('Plantación no encontrada');
  return row;
}

type FilaDePlantacion = Awaited<ReturnType<typeof filaDePlantacion>>;

const EDICION_NO_APLICADA = 'La plantación no se actualizó en el servidor. Los cambios no se guardaron.';

/** 0 filas sin error (RLS o fila inexistente, #482): el motivo si el server lo dice. */
async function edicionNoAplicada(plantacionId: string): Promise<Error> {
  const motivo = await motivoNoEscribible(plantacionId);
  return motivo ? new PlantacionNoEscribibleError(motivo) : new Error(EDICION_NO_APLICADA);
}

/**
 * Intenta pushear a Supabase solo lo que cambió y, si sale bien, deja los valores y el snapshot
 * *Server de lo subido. Sin cambios no hay UPDATE. Devuelve false ante una falla de red, para que el caller caiga al camino offline; cualquier
 * otro error del server se propaga tal cual.
 */
async function tryPushPlantationUpdateOnline(
  row: FilaDePlantacion,
  campos: Partial<CamposDePlantacion>
): Promise<boolean> {
  const cambios = cambiosParaElServer(row, campos);
  try {
    if (hayCambios(cambios)) {
      const { data, error } = await supabase
        .from('plantations')
        .update(aColumnasRemotas(cambios))
        .eq('id', row.id)
        .select('id');
      if (error) throw error;
      if (sinFilasAfectadas(data)) throw await edicionNoAplicada(row.id);
    }

    await db
      .update(plantations)
      .set({ ...campos, ...aSnapshot(cambios), pendingEdit: false })
      .where(eq(plantations.id, row.id));
    return true;
  } catch (e: any) {
    if (!isNetworkRequestFailed(e)) throw e;
    return false;
  }
}

/** Guarda la edición con pendingEdit=true; el snapshot se toma solo en la primera, para que descartar vuelva al último valor del server. */
async function applyOfflineEdit(
  campos: Partial<CamposDePlantacion>,
  row: FilaDePlantacion
): Promise<void> {
  await db
    .update(plantations)
    .set({
      ...campos,
      pendingEdit: true,
      ...(row.pendingEdit ? {} : snapshotAntesDeEditar(row)),
    })
    .where(eq(plantations.id, row.id));
}

/**
 * Actualiza los datos de la plantación: online pushea a Supabase; offline guarda local con
 * pendingEdit=true. Una creada offline (pendingSync) solo se edita local: el alta sube todo.
 * Los ajustes ausentes no se tocan.
 */
export async function updatePlantation(
  plantacionId: string,
  lugar: string,
  periodo: string,
  ajustes?: Partial<AjustesDePlantacion>
): Promise<void> {
  const row = await filaDePlantacion(plantacionId);
  const campos: Partial<CamposDePlantacion> = { lugar, periodo, ...(ajustes ?? {}) };

  if (row.pendingSync) {
    await db.update(plantations).set(campos).where(eq(plantations.id, plantacionId));
    notifyDataChanged();
    return;
  }

  const net = await NetInfo.fetch();
  if (net.isConnected !== false && (await tryPushPlantationUpdateOnline(row, campos))) {
    notifyDataChanged();
    return;
  }

  await applyOfflineEdit(campos, row);
  notifyDataChanged();
}

// ─── discardPlantationEdit ───────────────────────────────────────────────────

/** Revierte una edición offline pendiente a los snapshots *Server y limpia pendingEdit. Funciona sin red. */
export async function discardPlantationEdit(plantacionId: string): Promise<void> {
  const [row] = await db.select().from(plantations).where(eq(plantations.id, plantacionId));

  if (!row || !row.lugarServer || !row.periodoServer) {
    throw new Error('No hay datos del servidor para restaurar');
  }

  await db
    .update(plantations)
    .set({ ...restaurarDesdeSnapshot(row), pendingEdit: false })
    .where(eq(plantations.id, plantacionId));
  notifyDataChanged();
}

// ─── finalizePlantation ───────────────────────────────────────────────────────

/**
 * Thrown by finalizePlantation when Supabase committed 'finalizada' but the local SQLite mirror
 * failed to update: the finalize IS effective server-side, solo el device local quedó desfasado
 * (el próximo pullFromServer lo reconcilia). Distingue este caso de un fallo real de finalización.
 */
export class FinalizePlantationLocalSyncError extends Error {
  constructor(cause: unknown) {
    super('La plantación se finalizó en el servidor, pero no se pudo reflejar localmente');
    this.name = 'FinalizePlantationLocalSyncError';
    this.cause = cause;
  }
}

/** Finalizar con datos sin subir los deja sin poder subirse nunca (#537). Se chequea acá y no solo en la UI. */
export class FinalizePlantationPendientesError extends Error {
  readonly pendientes: ResumenDePendientes;
  constructor(pendientes: ResumenDePendientes) {
    super('La plantación tiene datos sin sincronizar');
    this.name = 'FinalizePlantationPendientesError';
    this.pendientes = pendientes;
  }
}

/** Marca la plantación 'finalizada' en Supabase Y en SQLite local: el update de server propaga a otros devices, el local mantiene la UI reactiva sin esperar el pull. */
export async function finalizePlantation(plantacionId: string): Promise<void> {
  const pendientes = await getResumenDePendientes(plantacionId);
  if (tienePendientes(pendientes)) throw new FinalizePlantationPendientesError(pendientes);

  const { error } = await supabase
    .from('plantations')
    .update({ estado: ESTADO_PLANTACION.finalizada })
    .eq('id', plantacionId);

  if (error) throw error;

  await reflejarEstadoLocal(plantacionId, ESTADO_PLANTACION.finalizada, (e) => new FinalizePlantationLocalSyncError(e));
}

/** Refleja en SQLite un cambio de estado que el server ya confirmó, sin esperar el pull. */
async function reflejarEstadoLocal(
  plantacionId: string,
  estado: EstadoPlantacion,
  errorDeDesfase: (causa: unknown) => Error,
): Promise<void> {
  try {
    await db.update(plantations).set({ estado }).where(eq(plantations.id, plantacionId));
  } catch (e) {
    syncLog.error(`Estado local '${estado}' falló tras éxito en server para ${plantacionId}`, e);
    throw errorDeDesfase(e);
  }
  notifyDataChanged();
}

// ─── reabrirPlantacion ────────────────────────────────────────────────────────

const RPC_REABRIR_PLANTACION = 'reabrir_plantacion';

const ERRORES_REAPERTURA = {
  /** No es superadmin activo de la organización de la plantación. */
  noAutorizado: 'NOT_AUTHORIZED',
  archivada: 'PLANTACION_ARCHIVADA',
} as const;

const MENSAJE_ERROR_REAPERTURA = 'No se pudo reabrir la plantación. Probá de nuevo.';

const MENSAJES_ERROR_REAPERTURA: Record<string, string> = {
  [ERRORES_REAPERTURA.noAutorizado]: 'Solo un superadmin puede reabrir una plantación.',
  [ERRORES_REAPERTURA.archivada]: 'La plantación está archivada: desarchivala antes de reabrirla.',
};

/** El server reabrió pero SQLite no se enteró: el próximo pull lo reconcilia. */
export class ReabrirPlantacionLocalSyncError extends Error {
  constructor(cause: unknown) {
    super('La plantación se reabrió en el servidor, pero no se pudo reflejar localmente');
    this.name = 'ReabrirPlantacionLocalSyncError';
    this.cause = cause;
  }
}

/**
 * Devuelve una finalizada al estado activo (#470, #637). Solo online y solo
 * superadmin: lo valida el RPC. Los grupos conservan su estado.
 */
export async function reabrirPlantacion(plantacionId: string): Promise<void> {
  const { data, error } = await supabase.rpc(RPC_REABRIR_PLANTACION, { p_id: plantacionId });
  if (error) throw new Error(MENSAJE_ERROR_REAPERTURA);
  const respuesta = data as { success?: boolean; error?: string } | null;
  if (!respuesta?.success) {
    throw new Error(MENSAJES_ERROR_REAPERTURA[respuesta?.error ?? ''] ?? MENSAJE_ERROR_REAPERTURA);
  }
  await reflejarEstadoLocal(plantacionId, ESTADO_PLANTACION.activa, (e) => new ReabrirPlantacionLocalSyncError(e));
}

// ─── saveSpeciesConfig ────────────────────────────────────────────────────────

/** Reemplaza el species config en Supabase en una sola transacción y sincroniza a SQLite vía pullFromServer. */
export async function saveSpeciesConfig(
  plantacionId: string,
  items: { especieId: string; ordenVisual: number }[]
): Promise<void> {
  await reemplazarConfiguracion({
    rpc: RPC_REEMPLAZAR_ESPECIES,
    args: {
      p_plantacion: plantacionId,
      p_especies: items.map((item) => ({ species_id: item.especieId, orden_visual: item.ordenVisual })),
    },
    sinRpc: () => escribirSiEsEscribible(plantacionId, BLOQUEAN_ESPECIES, () => reemplazarEspeciesSinRpc(plantacionId, items)),
  });
  await pullFromServer(plantacionId);
  notifyDataChanged();
}

/** Server sin la migración del RPC: borra y después inserta, no es atómico. */
async function reemplazarEspeciesSinRpc(
  plantacionId: string,
  items: { especieId: string; ordenVisual: number }[]
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('plantation_species')
    .delete()
    .eq('plantation_id', plantacionId);

  if (deleteError) throw deleteError;
  if (items.length === 0) return;

  const { error: insertError } = await supabase
    .from('plantation_species')
    .insert(
      items.map((item) => ({
        plantation_id: plantacionId,
        species_id: item.especieId,
        orden_visual: item.ordenVisual,
      }))
    );

  if (insertError) throw insertError;
}

// ─── saveSpeciesConfigLocally ─────────────────────────────────────────────────

/** Reemplaza atómicamente el species config solo en SQLite local (sin Supabase) — para configuración offline. */
export async function saveSpeciesConfigLocally(
  plantacionId: string,
  items: { especieId: string; ordenVisual: number }[]
): Promise<void> {
  await db.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));
  if (items.length > 0) {
    await db.insert(plantationSpecies).values(
      items.map((item) => ({
        id: plantationSpeciesId(plantacionId, item.especieId),
        plantacionId,
        especieId: item.especieId,
        ordenVisual: item.ordenVisual,
      }))
    );
  }
  notifyDataChanged();
}

// ─── assignTechnicians ────────────────────────────────────────────────────────

/** Reemplaza las asignaciones de técnicos en una sola transacción, sin tocar las membresías admin (#67), y sincroniza vía pullFromServer. */
export async function assignTechnicians(
  plantacionId: string,
  userIds: string[]
): Promise<void> {
  await reemplazarConfiguracion({
    rpc: RPC_REEMPLAZAR_TECNICOS,
    args: { p_plantacion: plantacionId, p_user_ids: userIds },
    sinRpc: () => escribirSiEsEscribible(plantacionId, BLOQUEAN_ASIGNACIONES, () => reemplazarTecnicosSinRpc(plantacionId, userIds)),
  });
  await pullFromServer(plantacionId);
  notifyDataChanged();
}

/** Server sin la migración del RPC: borra y después inserta, no es atómico. */
async function reemplazarTecnicosSinRpc(plantacionId: string, userIds: string[]): Promise<void> {
  const { error: deleteError, count: deleteCount } = await supabase
    .from('plantation_users')
    .delete()
    .eq('plantation_id', plantacionId)
    .eq('rol_en_plantacion', ROL.tecnico);

  console.log(`[Admin] Deleted ${deleteCount ?? '?'} plantation_users for ${plantacionId}`, deleteError ? `ERROR: ${deleteError.message}` : 'OK');
  if (deleteError) throw deleteError;
  if (userIds.length === 0) return;

  const now = new Date().toISOString();
  const { error: insertError } = await supabase
    .from('plantation_users')
    .insert(
      userIds.map((userId) => ({
        plantation_id: plantacionId,
        user_id: userId,
        rol_en_plantacion: ROL.tecnico,
        assigned_at: now,
      }))
    );

  if (insertError) throw insertError;
}

// ─── createPlantationWithParcelaLocally ──────────────────────────────────────

export interface CreatePlantationWithParcelaParams {
  lugar: string;
  periodo: string;
  organizacionId: string;
  creadoPor: string;
  ajustes?: Partial<AjustesDePlantacion>;
  /** Parcela default a crear junto con la plantación; omitir/null = solo plantación (AUTO_PARCELA_DEFAULT off). */
  parcela?: { nombre: string; codigo: string } | null;
}

/**
 * Crea la plantación + membresía admin local + (si se pasa `parcela`) su parcela default, todo en
 * UNA transacción SQLite (#300): local-first tanto para alta online como offline — si algo falla,
 * nada quedó escrito. No valida unicidad de nombre/codigo de parcela (a diferencia de
 * ParcelaRepository.createParcela): es la primera parcela de una plantación recién creada, no
 * puede colisionar.
 */
export async function createPlantationWithParcelaLocally(
  params: CreatePlantationWithParcelaParams
): Promise<{ id: string; lugar: string; periodo: string; estado: string }> {
  const plantationId = Crypto.randomUUID();
  const now = new Date().toISOString();

  await enTransaccion(async (tx) => {
    await tx.insert(plantations).values({
      id: plantationId,
      organizacionId: params.organizacionId,
      lugar: params.lugar,
      periodo: params.periodo,
      estado: ESTADO_PLANTACION.activa,
      creadoPor: params.creadoPor,
      createdAt: now,
      pendingSync: true,
      ...(params.ajustes ?? {}),
    });

    await tx
      .insert(plantationUsers)
      .values({
        plantationId,
        userId: params.creadoPor,
        rolEnPlantacion: ROL.admin,
        assignedAt: now,
      })
      .onConflictDoNothing();

    if (params.parcela) {
      await tx.insert(parcelas).values({
        id: Crypto.randomUUID(),
        plantacionId: plantationId,
        nombre: params.parcela.nombre,
        codigo: params.parcela.codigo,
        descripcion: null,
        pendingSync: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  });

  notifyDataChanged();
  return { id: plantationId, lugar: params.lugar, periodo: params.periodo, estado: ESTADO_PLANTACION.activa };
}

// --- deletePlantationLocally ------------------------------------------------

/** Borra la plantación y su data relacionada SOLO en SQLite (Supabase no se toca); orden manual porque SQLite no encadena FKs, incluye parcelas para evitar huérfanas (#90). Todo en una transacción. */
export async function deletePlantationLocally(plantacionId: string): Promise<void> {
  const fotos = await getLocalPhotoUrisForPlantation(plantacionId);
  await enTransaccion(async (tx) => {
    await tx.delete(trees).where(
      sql`${trees.groupId} IN (SELECT id FROM groups WHERE plantacion_id = ${plantacionId})`
    );
    await tx.delete(groups).where(eq(groups.plantacionId, plantacionId));
    await tx.delete(parcelas).where(eq(parcelas.plantacionId, plantacionId));
    await tx.delete(plantationSpecies).where(eq(plantationSpecies.plantacionId, plantacionId));
    await tx.delete(plantationUsers).where(eq(plantationUsers.plantationId, plantacionId));
    await tx.delete(userSpeciesOrder).where(eq(userSpeciesOrder.plantacionId, plantacionId));
    // Los borrados anotados se abandonan con la plantación: sacarla del device no
    // toca Supabase, así que no hay nada que propagar. Y si quedaran, al volver a
    // descargarla el pull escondería esos árboles para siempre (#467).
    await tx.delete(borradosPendientes).where(eq(borradosPendientes.plantacionId, plantacionId));
    await tx.delete(plantations).where(eq(plantations.id, plantacionId));
  });
  // Recién después del commit: con rollback las filas siguen apuntando a los archivos (#484).
  borrarFotosLocales(fotos);
  notifyDataChanged();
}
