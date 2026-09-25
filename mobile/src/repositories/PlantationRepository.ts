/**
 * PlantationRepository — mutaciones admin: escriben a Supabase primero, sincronizan a SQLite después.
 * IDs finales (plantacion_id/global_id) los genera el server (RPC generate_tree_ids, #232) y llegan vía pull.
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { enTransaccion } from '../database/transaccion';
import { plantations, parcelas, trees, groups, plantationSpecies, plantationUsers, userSpeciesOrder, borradosPendientes, cambiosEspeciesPendientes } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { notifyDataChanged } from '../database/liveQuery';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';
import { isNetworkRequestFailed } from '../utils/networkErrors';
import { syncLog } from '../utils/syncLogger';
import { ROL } from '../constants/roles';
import { ESTADO_PLANTACION, type EstadoPlantacion } from '../constants/estados';
import { esMotivoNoEscribible, PlantacionNoEscribibleError } from '../services/PlantacionEscribibleService';
import { borrarAltasDeTecnicosDePlantacion } from './TecnicosDePlantacionRepository';
import { getResumenDePendientes, type ResumenDePendientes } from '../queries/catalogQueries';
import { tienePendientes } from '../utils/finalizarPlantacion';
import { getLocalPhotoUrisForPlantation } from './TreeRepository';
import { borrarFotosLocales } from '../services/PhotoService';
import {
  esRechazada,
  mensajeDeRechazo,
  registrarEdicionSubida,
  subirEdicion,
} from '../services/sync/edicionDePlantacion';
import {
  baseDeLaEdicion,
  camposDeFila,
  edicionDelFormulario,
  type EdicionDelFormulario,
  restaurarDesdeSnapshot,
  snapshotAntesDeEditar,
  type AjustesDePlantacion,
  type CampoDePlantacion,
  type CamposDePlantacion,
} from '../utils/camposDePlantacion';
import { ELECCION, combinarConflictos, type ConflictoDeCampo, type Eleccion } from '../utils/conflictosDeEdicion';

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

/** El server rechazó la edición por permisos o datos: no se guarda nada. */
export class EdicionRechazadaError extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super(mensajeDeRechazo(codigo));
    this.name = 'EdicionRechazadaError';
    this.codigo = codigo;
  }
}

function errorDeRechazo(codigo: string): Error {
  return esMotivoNoEscribible(codigo) ? new PlantacionNoEscribibleError(codigo) : new EdicionRechazadaError(codigo);
}

/**
 * Sube por `editar_plantacion` solo lo que cambió y deja la fila con lo que quedó en el server.
 * Devuelve cuántos campos chocaron con la web, o null ante una falla de red, para que el caller
 * caiga al camino offline. Un rechazo lanza el error con el motivo; otro error, tal cual.
 */
async function tryPushPlantationUpdateOnline(row: FilaDePlantacion, edicion: EdicionDelFormulario): Promise<number | null> {
  const { tocados, cambios, base } = edicion;
  try {
    const resultado = await subirEdicion(row.id, cambios, base);
    if (esRechazada(resultado)) throw errorDeRechazo(resultado.rechazo ?? '');
    return await registrarEdicionSubida(row, { vivos: tocados, cambios, base, resultado });
  } catch (e: any) {
    if (!isNetworkRequestFailed(e)) throw e;
    return null;
  }
}

/**
 * Guarda lo tocado con pendingEdit=true. El snapshot se toma solo en la primera edición,
 * para que descartar vuelva al valor del server; la base se amplía con lo recién tocado.
 */
async function applyOfflineEdit(row: FilaDePlantacion, edicion: EdicionDelFormulario): Promise<void> {
  await db
    .update(plantations)
    .set({
      ...edicion.tocados,
      pendingEdit: true,
      editadaLocalmenteEn: new Date().toISOString(),
      baseDeEdicion: edicion.baseDeEdicion,
      // Volver a editar un campo en conflicto lo supera: sube con su propia base.
      conflictosDeEdicion: combinarConflictos(row.conflictosDeEdicion, edicion.tocados, []),
      ...(row.pendingEdit ? {} : snapshotAntesDeEditar(row)),
    })
    .where(eq(plantations.id, row.id));
}

/**
 * Actualiza los datos de la plantación: online sube por `editar_plantacion`; offline guarda
 * local con pendingEdit=true. Una creada offline (pendingSync) solo se edita local: el alta
 * sube todo. `vistos` son los valores con que se abrió el formulario: solo se escribe lo que
 * difiere de ellos. Devuelve cuántos campos chocaron con un cambio de la web (quedan para
 * "Resolver cambios"); 0 offline.
 */
export async function updatePlantation(
  plantacionId: string,
  lugar: string,
  periodo: string,
  ajustes?: Partial<AjustesDePlantacion>,
  vistos?: Partial<CamposDePlantacion>
): Promise<number> {
  const row = await filaDePlantacion(plantacionId);
  const campos: Partial<CamposDePlantacion> = { lugar, periodo, ...(ajustes ?? {}) };

  if (row.pendingSync) {
    await db.update(plantations).set(campos).where(eq(plantations.id, plantacionId));
    notifyDataChanged();
    return 0;
  }

  const edicion = edicionDelFormulario(row, campos, vistos);
  const net = await NetInfo.fetch();
  const enConflicto = net.isConnected !== false ? await tryPushPlantationUpdateOnline(row, edicion) : null;
  if (enConflicto === null) await applyOfflineEdit(row, edicion);
  notifyDataChanged();
  return enConflicto ?? 0;
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
    .set({ ...restaurarDesdeSnapshot(row), pendingEdit: false, baseDeEdicion: null, editadaLocalmenteEn: null })
    .where(eq(plantations.id, plantacionId));
  notifyDataChanged();
}

// ─── resolverCambios ──────────────────────────────────────────────────────────

export type Elecciones = Partial<Record<CampoDePlantacion, Eleccion>>;

/**
 * Resuelve los campos que chocaron con la web (#634), todos en un solo UPDATE. Con la web, el
 * valor ya está: se descarta el propio. Con el propio, se re-encola como edición offline con
 * la web como base y sube en el próximo sync (si alguien lo volvió a cambiar, vuelve a chocar).
 * Los campos sin elección siguen pendientes.
 */
export async function resolverCambios(plantacionId: string, elecciones: Elecciones): Promise<void> {
  const row = await filaDePlantacion(plantacionId);
  const conflictos = row.conflictosDeEdicion ?? [];
  const resueltos = conflictos.filter((c) => elecciones[c.campo] !== undefined);
  if (resueltos.length === 0) return;
  const pendientes = conflictos.filter((c) => elecciones[c.campo] === undefined);
  const propios = resueltos.filter((c) => elecciones[c.campo] === ELECCION.mio);
  await db
    .update(plantations)
    .set({
      conflictosDeEdicion: pendientes.length > 0 ? pendientes : null,
      ...(propios.length > 0 ? edicionReencolada(row, propios) : {}),
    })
    .where(eq(plantations.id, plantacionId));
  notifyDataChanged();
}

function edicionReencolada(row: FilaDePlantacion, propios: ConflictoDeCampo[]) {
  const baseAnterior = row.pendingEdit ? baseDeLaEdicion(row) : camposDeFila(row);
  return {
    ...Object.fromEntries(propios.map((c) => [c.campo, c.mio])),
    pendingEdit: true,
    editadaLocalmenteEn: row.editadaLocalmenteEn ?? propios[0].mioEn,
    baseDeEdicion: { ...baseAnterior, ...Object.fromEntries(propios.map((c) => [c.campo, c.web])) },
    ...(row.pendingEdit ? {} : snapshotAntesDeEditar(row)),
  };
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
    await tx.delete(cambiosEspeciesPendientes).where(eq(cambiosEspeciesPendientes.plantacionId, plantacionId));
    await borrarAltasDeTecnicosDePlantacion(tx, plantacionId);
    await tx.delete(plantations).where(eq(plantations.id, plantacionId));
  });
  // Recién después del commit: con rollback las filas siguen apuntando a los archivos (#484).
  borrarFotosLocales(fotos);
  notifyDataChanged();
}
