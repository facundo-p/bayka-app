import { supabase } from '../../supabase/client';
import { db } from '../../database/client';
import { groups, trees, plantationUsers, plantationSpecies, plantations, species, parcelas } from '../../database/schema';
import { eq, and, sql, inArray, notInArray } from 'drizzle-orm';
import { isLocalUri, isRemoteUri, sqlIsLocalUri } from '../../utils/photoUri';
import { borrarFotosLocales } from '../PhotoService';
import { syncLog } from '../../utils/syncLogger';
import { aSnapshot, desdeFilaRemota, rebaseDeEdicionPendiente, tieneCambiosSinSubir } from '../../utils/camposDePlantacion';
import { fetchAllRows } from './paginate';
import { enTransaccion, enTransaccionPorLotes } from '../../database/transaccion';
import {
  DOWNLOAD_PHASE,
  ESTADO_REMOTO,
  PULL_OK,
  PULL_SIN_ACCESO,
  RPC_ESTADO_REMOTO_PLANTACIONES,
  SYNC_ERROR,
  esPullSinDatos,
  existeConAcceso,
  pullDesdeEstadoRemoto,
} from './types';
import type { DownloadPhase, DownloadPhaseProgress, PullResult } from './types';
import { marcandoActividadDeSync } from './syncActivityStore';
import { borradosPorTipo, type BorradosPorTipo } from '../../repositories/BorradosRepository';
import { abortarSiCancelado } from './cancelacion';
import { esFuncionInexistente } from '../../supabase/postgresErrorCodes';
import { marcarEliminadaEnServidor, desmarcarEliminadaEnServidor } from '../../repositories/EliminadaEnServidorRepository';
import { asegurarEspecies } from './catalogoDeEspecies';
import { plantationSpeciesId } from '../../utils/plantationSpeciesId';
import { comoAltasYBajas, getCambiosPendientes } from '../../repositories/CambiosDeEspeciesRepository';
import { getAltasPendientes } from '../../repositories/TecnicosDePlantacionRepository';
import { recalcularSubIdsDeLaParcela } from '../../repositories/subIdsDeArboles';
import { anotarPullConAcceso, anotarRechazo, conRegistroDeVarados } from './pendientesVarados';
import { adoptarRenombres, gruposLocales, planDeRenombres, type GrupoLocal, type RemoteGroup } from './renombresDeGrupos';

export type OnPhaseProgress = (p: DownloadPhaseProgress) => void;

function emitProgress(
  onProgress: OnPhaseProgress | undefined,
  phase: DownloadPhase,
  done: number,
  total: number,
): void {
  onProgress?.({ phase, phaseDone: done, phaseTotal: total });
}

/**
 * Progreso de un lote escrito, más el corte de cancelación. `onLote` corre ENTRE
 * transacciones: es el único punto donde abortar no deja la base a medias (#451).
 */
function alEscribirLote(
  onProgress: OnPhaseProgress | undefined,
  phase: DownloadPhase,
  total: number,
) {
  return (escritas: number) => {
    emitProgress(onProgress, phase, escritas, total);
    abortarSiCancelado();
  };
}

/** Callback de paginación: reporta filas bajadas, con el total todavía desconocido. */
function alBajarPagina(onProgress: OnPhaseProgress | undefined, phase: DownloadPhase) {
  return (filas: number) =>
    onProgress?.({ phase, phaseDone: filas, phaseTotal: 0, descargando: true });
}

// ─── Pull helpers ────────────────────────────────────────────────────────────

/**
 * Plantación creada offline que todavía no subió: el server no la conoce aún, así que
 * un replace borraría lo local (la membresía del creador, #67; sus especies, #632).
 */
async function tienePushPendiente(plantacionId: string): Promise<boolean> {
  const [local] = await db
    .select({ pendingSync: plantations.pendingSync })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  return local?.pendingSync ?? false;
}

/**
 * Chequeo de membresía de servers sin `estado_remoto_plantaciones`. Mismo criterio
 * que las policies de SELECT (`is_plantation_member`); no distingue eliminada.
 */
async function membresiaRemota(plantacionId: string, userId: string): Promise<PullResult> {
  const { data, error } = await supabase
    .from('plantation_users')
    .select('user_id')
    // (plantation_id, user_id) es la PK: vuelve una fila o ninguna.
    .eq('plantation_id', plantacionId)
    .eq('user_id', userId);
  if (error) {
    syncLog.error('Chequeo de membresía falló:', JSON.stringify(error));
    return PULL_OK;
  }
  return (data ?? []).length > 0 ? PULL_OK : PULL_SIN_ACCESO;
}

/** Deja la marca local alineada con lo que respondió el server. */
async function registrarEstadoRemoto(plantacionId: string, estado: string | undefined): Promise<void> {
  if (estado === ESTADO_REMOTO.eliminada) await marcarEliminadaEnServidor(plantacionId);
  // Sin membresía lo pendiente no sube: queda varado sin permiso (#638).
  else if (estado === ESTADO_REMOTO.sinAcceso) await anotarRechazo(plantacionId, SYNC_ERROR.PERMISSION);
  else if (existeConAcceso(estado)) {
    await desmarcarEliminadaEnServidor(plantacionId);
    await anotarPullConAcceso(plantacionId);
  }
}

async function consultarEstadoRemoto(plantacionId: string, userId: string): Promise<PullResult> {
  const { data, error } = await supabase.rpc(RPC_ESTADO_REMOTO_PLANTACIONES, { p_ids: [plantacionId] });
  if (error) {
    if (esFuncionInexistente(error)) return membresiaRemota(plantacionId, userId);
    syncLog.error('Chequeo de estado remoto falló:', JSON.stringify(error));
    return PULL_OK;
  }
  const estado: string | undefined = (data ?? [])[0]?.estado;
  await registrarEstadoRemoto(plantacionId, estado);
  return pullDesdeEstadoRemoto(estado);
}

/**
 * ¿La plantación sigue existiendo en el server y el usuario es miembro? (#317, #478)
 *
 * Solo corta ante evidencia positiva: si no hay sesión, si la consulta falla
 * (offline) o si la plantación todavía no se pusheó, se asume acceso y el pull
 * sigue su camino de siempre.
 */
async function accesoRemoto(plantacionId: string): Promise<PullResult> {
  if (await tienePushPendiente(plantacionId)) return PULL_OK;
  const { data: sesion } = await supabase.auth.getSession();
  const userId = sesion?.session?.user?.id;
  if (!userId) return PULL_OK;
  return consultarEstadoRemoto(plantacionId, userId);
}

async function pullPlantationMetadata(plantacionId: string): Promise<void> {
  // select('*') tolera servers sin alguna columna nueva: desdeFilaRemota omite lo ausente.
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

  const remotos = desdeFilaRemota(remotePlantation);
  const [local] = await db.select().from(plantations).where(eq(plantations.id, plantacionId));

  // El snapshot *Server se refresca siempre. Con cambios locales sin subir (edición, o un alta
  // que ya está en el server pero no terminó de subir), solo los valores vivos no editados.
  await db
    .update(plantations)
    .set({
      estado: remotePlantation.estado,
      archivadaEn: remotePlantation.archivada_en ?? null,
      ...aSnapshot(remotos),
      ...(local && tieneCambiosSinSubir(local) ? rebaseDeEdicionPendiente(local, remotos) : remotos),
    })
    .where(eq(plantations.id, plantacionId));
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

type ParcelaLocal = { pendingSync: boolean; codigo: string };

/** Un solo select previo: evita una lectura por parcela dentro del loop. */
async function parcelasLocales(plantacionId: string): Promise<Map<string, ParcelaLocal>> {
  const filas = await db
    .select({ id: parcelas.id, pendingSync: parcelas.pendingSync, codigo: parcelas.codigo })
    .from(parcelas)
    .where(eq(parcelas.plantacionId, plantacionId));
  return new Map(filas.map(({ id, ...local }) => [id, local]));
}

async function escribirLoteDeParcelas(tx: Tx, lote: RemoteParcela[], locales: Map<string, ParcelaLocal>): Promise<void> {
  const aEscribir = lote.filter((remota) => !locales.get(remota.id)?.pendingSync);
  if (aEscribir.length === 0) return;
  await upsertParcelas(tx, aEscribir);
  await recalcularCodigosCambiados(tx, aEscribir, locales);
}

async function upsertParcelas(tx: Tx, remotas: RemoteParcela[]): Promise<void> {
  await tx.insert(parcelas).values(remotas.map((remoteParcela) => ({
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
}

/**
 * Otro dispositivo cambió el código: los SubID locales se reescriben acá, incluidos los de grupos
 * pendientes, porque el pull de árboles conserva el SubID local. No marca nada para sync.
 */
async function recalcularCodigosCambiados(
  tx: Tx,
  remotas: RemoteParcela[],
  locales: Map<string, ParcelaLocal>,
): Promise<void> {
  for (const remota of remotas) {
    const anterior = locales.get(remota.id)?.codigo;
    if (anterior == null || anterior === remota.codigo) continue;
    await recalcularSubIdsDeLaParcela(tx, remota.id, { anterior, nuevo: remota.codigo });
  }
}

/**
 * Trae parcelas del server y las upsertea local; si pending_sync=true localmente (cambio o tombstone
 * sin subir), no se sobrescribe — el push subsiguiente gana. Devuelve las pendientes cuyo código
 * local difiere del remoto: sus árboles bajan con el prefijo del server.
 */
async function pullParcelas(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<CodigoDivergente[]> {
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

  const locales = await parcelasLocales(plantacionId);
  await enTransaccionPorLotes(all, (tx, lote) => escribirLoteDeParcelas(tx, lote, locales),
    alEscribirLote(onProgress, DOWNLOAD_PHASE.parcelas, all.length),
  );
  emitProgress(onProgress, DOWNLOAD_PHASE.parcelas, all.length, all.length);

  return codigosDivergentes(all, locales);
}

type CodigoDivergente = { id: string; remoto: string; local: string };

function codigosDivergentes(remotas: RemoteParcela[], locales: Map<string, ParcelaLocal>): CodigoDivergente[] {
  return remotas.flatMap((remota) => {
    const local = locales.get(remota.id);
    if (!local?.pendingSync || local.codigo === remota.codigo) return [];
    return [{ id: remota.id, remoto: remota.codigo, local: local.codigo }];
  });
}

/**
 * Una parcela con el código cambiado sin subir: los árboles que el pull trajo tienen el prefijo del
 * server, y el upsert conserva después el SubID local de los que tienen especie. Se pasan al
 * código local ahora; al subir la parcela, el trigger hace lo mismo en el server. No marca nada.
 */
async function reescribirSubIdsDeParcelasPendientes(divergentes: CodigoDivergente[]): Promise<void> {
  if (divergentes.length === 0) return;
  await enTransaccion(async (tx) => {
    for (const { id, remoto, local } of divergentes) {
      await recalcularSubIdsDeLaParcela(tx, id, { anterior: remoto, nuevo: local });
    }
  });
}

/** Local push wins: los grupos con cambios sin subir no se escriben. */
async function escribirLoteDeGrupos(tx: Tx, lote: RemoteGroup[], locales: Map<string, GrupoLocal>): Promise<void> {
  const aEscribir = lote.filter((sg) => !locales.get(sg.id)?.pendingSync);
  if (aEscribir.length === 0) return;
  await tx.insert(groups).values(aEscribir.map((sg) => ({
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
    // Código y nombre de los existentes los escribe `adoptarRenombres`, antes de los lotes.
    set: {
      parcelaId: sql`excluded.parcela_id`,
      estado: sql`excluded.estado`,
      tipo: sql`excluded.tipo`,
    },
  });
}

/** Ids remotos de los grupos, y cuáles de ellos tienen cambios locales sin subir. */
interface GruposDelPull {
  ids: string[];
  pendientes: Set<string>;
}

async function pullGroups(
  plantacionId: string,
  gruposBorrados: Set<string>,
  onProgress?: OnPhaseProgress,
): Promise<GruposDelPull> {
  const { data: remoteGroups, error } = await fetchAllRows<RemoteGroup>(() =>
    supabase.from('groups').select('*').eq('plantation_id', plantacionId),
    alBajarPagina(onProgress, DOWNLOAD_PHASE.groups),
  );

  if (error) {
    syncLog.error('Pull groups error:', JSON.stringify(error));
    emitProgress(onProgress, DOWNLOAD_PHASE.groups, 0, 0);
    return { ids: [], pendientes: new Set() };
  }
  // Un grupo borrado localmente sigue existiendo en el server hasta que el push lo
  // saque, y su fila local ya no está — así que `pendingSync` no puede protegerlo.
  // Sin excluirlo acá el pull lo resucita, con todos sus árboles, antes de que el
  // push alcance a borrarlo (#467).
  const all = (remoteGroups ?? []).filter((sg) => !gruposBorrados.has(sg.id));
  syncLog.info('Pull groups:', all.length, 'rows');
  emitProgress(onProgress, DOWNLOAD_PHASE.groups, 0, all.length);
  if (all.length === 0) return { ids: [], pendientes: new Set() };

  // Pre-fetch (igual que pullParcelas): el pull no debe pisar un grupo dirty (p.ej. una transición activa→finalizada sin subir).
  const locales = await gruposLocales(plantacionId);
  const pendingLocally = new Set([...locales].filter(([, g]) => g.pendingSync).map(([id]) => id));

  // #90: parcela obligatoria; el throw aborta el pull y se reporta en la UI de sync
  // (no se degrada insertando null en silencio). Se valida antes de escribir nada:
  // un dato inválido no deja la tabla a medio llenar. Los grupos con cambios
  // locales sin subir quedan afuera del chequeo porque tampoco se escriben: su
  // fila del server es la vieja, y el push que viene la reemplaza.
  const sinParcela = all.find((sg) => sg.parcela_id == null && !pendingLocally.has(sg.id));
  if (sinParcela) {
    throw new Error(`Grupo ${sinParcela.id} sin parcela en el server: dato inválido (#90).`);
  }

  // Antes de los lotes: una rotación de códigos puede cruzar dos lotes.
  const renombres = planDeRenombres(all, locales);
  if (renombres.length > 0) await enTransaccion((tx) => adoptarRenombres(tx, renombres));

  await enTransaccionPorLotes(all, (tx, lote) => escribirLoteDeGrupos(tx, lote, locales),
    alEscribirLote(onProgress, DOWNLOAD_PHASE.groups, all.length),
  );
  emitProgress(onProgress, DOWNLOAD_PHASE.groups, all.length, all.length);

  // `pendientes` viaja a la fase de árboles: hasta acá el pull respetaba los grupos
  // sucios pero igual les pisaba los árboles (#467).
  return { ids: all.map((sg) => sg.id), pendientes: pendingLocally };
}

/** Miembros locales que el server ya no tiene. Un alta pendiente de subir todavía no llegó: no cuenta (#636). */
async function miembrosRevocados(plantacionId: string, remotos: Set<string>, pendientes: Set<string>): Promise<string[]> {
  const locales = await db.select({ userId: plantationUsers.userId }).from(plantationUsers)
    .where(eq(plantationUsers.plantationId, plantacionId));
  return locales.map((l) => l.userId).filter((id) => !remotos.has(id) && !pendientes.has(id));
}

async function pullPlantationUsers(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  if (await tienePushPendiente(plantacionId)) {
    syncLog.info('Pull plantation_users: plantación pendiente de push, se omite el replace');
    emitProgress(onProgress, DOWNLOAD_PHASE.usuarios, 0, 0);
    return;
  }

  // Antes de bajar: un alta que la subida en segundo plano confirme en el medio ya
  // está en lo que baja; leída después, no estaría en ningún lado y se borraría.
  const pendientes = new Set(await getAltasPendientes(plantacionId));
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

  const revocados = await miembrosRevocados(plantacionId, new Set(all.map((pu: any) => pu.user_id)), pendientes);

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

/**
 * Filas del server cuya especie quedó en el catálogo local. Escribir las demás
 * dejaría la referencia colgada; quedan para la próxima sync (#614). Una fila sin
 * especie (árbol N/N) pasa siempre.
 */
async function conEspecieLocal(filas: any[], fase: DownloadPhase): Promise<any[]> {
  const disponibles = await asegurarEspecies(filas.map((f) => f.species_id));
  const escribibles = filas.filter((f) => !f.species_id || disponibles.has(f.species_id));
  const omitidas = filas.length - escribibles.length;
  if (omitidas > 0) syncLog.error(`Pull ${fase}: ${omitidas} omitidas, su especie no está en el server ni en el catálogo local`);
  return escribibles;
}

/** Una especie deshabilitada en el server deja de ofrecerse en el teléfono (#632). */
async function quitarEspeciesAusentes(plantacionId: string, remotas: string[]): Promise<void> {
  const dePlantacion = eq(plantationSpecies.plantacionId, plantacionId);
  await db.delete(plantationSpecies).where(
    remotas.length > 0 ? and(dePlantacion, notInArray(plantationSpecies.especieId, remotas)) : dePlantacion,
  );
}

async function pullPlantationSpecies(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  if (await tienePushPendiente(plantacionId)) {
    syncLog.info('Pull plantation_species: plantación pendiente de push, se omite el replace');
    emitProgress(onProgress, DOWNLOAD_PHASE.especiesPlantacion, 0, 0);
    return;
  }
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

  // Lo pendiente de subir manda sobre el server: un alta no se borra, una baja no vuelve (#635).
  const { altas, bajas } = comoAltasYBajas(await getCambiosPendientes(plantacionId));
  const sinBajas = all.filter((ps: any) => !bajas.includes(ps.species_id));
  // Fuera de la transacción del upsert: si se corta en el medio, el próximo pull lo completa.
  await quitarEspeciesAusentes(plantacionId, [...sinBajas.map((ps: any) => ps.species_id), ...altas]);
  if (sinBajas.length === 0) return;

  const escribibles = await conEspecieLocal(sinBajas, DOWNLOAD_PHASE.especiesPlantacion);
  await enTransaccionPorLotes(escribibles, async (tx, lote) => {
      await tx.insert(plantationSpecies).values(lote.map((ps: any) => ({
        id: plantationSpeciesId(ps.plantation_id, ps.species_id),
        plantacionId: ps.plantation_id,
        especieId: ps.species_id,
        ordenVisual: ps.orden_visual,
      }))).onConflictDoUpdate({
        target: plantationSpecies.id,
        set: { ordenVisual: sql`excluded.orden_visual` },
      });
    },
    alEscribirLote(onProgress, DOWNLOAD_PHASE.especiesPlantacion, all.length),
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

/** Lo que el pull necesita saber de cada árbol local antes de escribir. */
export type ArbolLocal = { especieId: string | null; fotoUrl: string | null; fotoSynced: boolean };

/**
 * Fotos locales ya subidas cuyo árbol el server manda ahora sin foto: la
 * quitaron desde otro dispositivo (#517). El upsert limpia la referencia; el
 * archivo se borra después del commit. Una foto pendiente de subir
 * (`fotoSynced = false`) no cuenta: es la copia que el server todavía no tiene.
 */
export function fotosQuitadasEnServer(remotos: any[], locales: Map<string, ArbolLocal>): string[] {
  const quitadas: string[] = [];
  for (const remoto of remotos) {
    if (isRemoteUri(remoto.foto_url)) continue;
    const local = locales.get(remoto.id);
    if (local?.fotoSynced && isLocalUri(local.fotoUrl)) quitadas.push(local.fotoUrl);
  }
  return quitadas;
}

/** Upsert de un lote de árboles del server en un solo statement. */
export async function upsertTreesFromServerTx(tx: Tx, remotos: any[]): Promise<void> {
  if (remotos.length === 0) return;

  // La foto local se conserva mientras esté pendiente de subir o el server siga
  // teniendo foto; si ya se subió y el server la quitó, se limpia (#517).
  const conservarFotoLocal = sql`${sqlIsLocalUri(trees.fotoUrl)} AND (${trees.fotoSynced} = 0 OR excluded.foto_synced = 1)`;

  await tx.insert(trees).values(remotos.map(filaDeArbol)).onConflictDoUpdate({
    target: trees.id,
    set: {
      especieId: sql`CASE WHEN ${trees.especieId} IS NOT NULL THEN ${trees.especieId} ELSE excluded.especie_id END`,
      posicion: sql`excluded.posicion`,
      subId: sql`CASE WHEN ${trees.especieId} IS NOT NULL THEN ${trees.subId} ELSE excluded.sub_id END`,
      fotoUrl: sql`CASE WHEN ${conservarFotoLocal} THEN ${trees.fotoUrl} ELSE excluded.foto_url END`,
      // `excluded.foto_synced` es el "hay foto en el server" de ESA fila: con un
      // insert multi-fila la condición viaja en los valores, no en el `set`.
      fotoSynced: sql`CASE WHEN excluded.foto_synced = 1 THEN 1 WHEN ${conservarFotoLocal} THEN ${trees.fotoSynced} ELSE 0 END`,
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
 * Especie y foto local de cada árbol de esos grupos, en una sola lectura (#449):
 * antes el chequeo de conflicto costaba dos selects por árbol. Alcanza con
 * filtrar por grupo porque un árbol nunca cambia de grupo — ni el alta ni el
 * upsert del pull tocan `group_id` después de crearlo.
 */
async function arbolesLocalesPorId(remoteGroupIds: string[]): Promise<Map<string, ArbolLocal>> {
  const locales = await db
    .select({ id: trees.id, especieId: trees.especieId, fotoUrl: trees.fotoUrl, fotoSynced: trees.fotoSynced })
    .from(trees)
    .where(inArray(trees.groupId, remoteGroupIds));
  return new Map(locales.map(({ id, ...arbol }) => [id, arbol]));
}

/**
 * Árboles que el pull NO debe tocar (#467):
 *
 * - los de un grupo con cambios locales sin subir — es el mismo criterio que ya
 *   aplican `pullParcelas` y `pullGroups`, y sin él la renumeración de un borrado
 *   se revierte a medias: la `posicion` vuelve a la del server y el `sub_id` local
 *   se queda, dejando SubIDs que no corresponden a su posición;
 * - los borrados que todavía no se propagaron, aunque el grupo ya no esté
 *   pendiente: el push baja la marca y sin esto el pull siguiente los resucita.
 */
function omitirDelPull(
  gruposPendientes: Set<string>,
  arbolesBorrados: Set<string>,
  existeLocal: Map<string, string | null>,
) {
  return (remoto: any): boolean => {
    if (arbolesBorrados.has(remoto.id)) return true;
    // El guard protege lo que YA existe local, no bloquea la fase entera: un árbol
    // nuevo del server no puede pisar ninguna edición local, y saltearlo dejaría al
    // técnico sin ver lo que cargó otro mientras el push del grupo siga fallando.
    return existeLocal.has(remoto.id) && gruposPendientes.has(remoto.group_id ?? remoto.subgroup_id);
  };
}

/**
 * Una foto quitada localmente sigue en el server hasta que el push la propaga. Se
 * baja la fila sin foto: con la foto, el pull la restaura y se vuelve a descargar
 * (#498).
 */
function sinFotoQuitada(fotosQuitadas: Set<string>) {
  return (remoto: any) => (fotosQuitadas.has(remoto.id) ? { ...remoto, foto_url: null } : remoto);
}

async function pullTrees(
  grupos: GruposDelPull,
  borrados: BorradosPorTipo,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  const remoteGroupIds = grupos.ids;
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

  const locales = await arbolesLocalesPorId(remoteGroupIds);
  const especieLocal = new Map([...locales].map(([id, arbol]) => [id, arbol.especieId]));

  const aEscribir = await arbolesAEscribir(all, grupos, borrados, especieLocal);
  // Descarga fresh: sin filas locales no hay nada con qué chocar.
  if (especieLocal.size === 0) syncLog.info('Pull trees: fresh download — sin árboles locales');

  await escribirArboles(aEscribir, locales, all.length, onProgress);
  emitProgress(onProgress, DOWNLOAD_PHASE.arboles, all.length, all.length);
}

/** Descarta lo que el pull no debe pisar y los árboles cuya especie no se pudo conseguir. */
async function arbolesAEscribir(
  all: any[],
  grupos: GruposDelPull,
  borrados: BorradosPorTipo,
  especieLocal: Map<string, string | null>,
): Promise<any[]> {
  const omitir = omitirDelPull(grupos.pendientes, borrados.arboles, especieLocal);
  const noOmitidos = all.filter((t: any) => !omitir(t));
  const omitidos = all.length - noOmitidos.length;
  if (omitidos > 0) syncLog.info(`Pull trees: ${omitidos} omitidos (edición local sin subir o borrado sin propagar)`);
  // Antes de los conflictos: el nombre de la especie del server sale del catálogo local.
  return conEspecieLocal(noOmitidos.map(sinFotoQuitada(borrados.fotos)), DOWNLOAD_PHASE.arboles);
}

async function escribirArboles(
  aEscribir: any[],
  locales: Map<string, ArbolLocal>,
  total: number,
  onProgress?: OnPhaseProgress,
): Promise<void> {
  const especieLocal = (id: string) => locales.get(id)?.especieId;
  const conflictivos = aEscribir
    .map((remoto: any) => ({ remoto, especieLocal: especieLocal(remoto.id) }))
    .filter(esConflictoDeEspecie);
  const enConflicto = await marcarConflictosDeEspecie(conflictivos);

  const escribibles = aEscribir.filter((t: any) => !enConflicto.has(t.id));
  const archivosQuitados = fotosQuitadasEnServer(escribibles, locales);
  await enTransaccionPorLotes(aEscribir, async (tx, lote) => {
      await upsertTreesFromServerTx(tx, lote.filter((t: any) => !enConflicto.has(t.id)));
    },
    alEscribirLote(onProgress, DOWNLOAD_PHASE.arboles, total),
  );
  // Recién con los lotes commiteados: con rollback la fila seguiría apuntando al archivo.
  if (archivosQuitados.length > 0) {
    syncLog.info(`Pull trees: ${archivosQuitados.length} fotos quitadas en el server, se borran del dispositivo`);
    borrarFotosLocales(archivosQuitados);
  }
}

/**
 * Duración de cada fase. Es la única forma de medir en device si un cambio en la
 * escritura sirvió: jest no corre expo-sqlite, así que el número real solo aparece
 * en el log de la app (#448).
 */
async function conDuracion<T>(fase: DownloadPhase, tarea: () => Promise<T>): Promise<T> {
  // Entre fases: la anterior ya commiteó y la siguiente todavía no abrió nada.
  abortarSiCancelado();
  const inicio = Date.now();
  try {
    return await tarea();
  } finally {
    syncLog.info(`Pull fase ${fase}: ${Date.now() - inicio}ms`);
  }
}

// ─── Pull from server ─────────────────────────────────────────────────────────

/** Descarga plantación/parcelas/groups/usuarios/especies/árboles del server y los upsertea en SQLite; parcelas van antes que groups por FK.
 *  Corta antes de tocar la base si la membresía fue revocada o la plantación se eliminó: la copia local se conserva tal cual. */
async function correrPullFromServer(
  plantacionId: string,
  onProgress?: OnPhaseProgress,
): Promise<PullResult> {
  // Cancelado antes de arrancar: ni el chequeo de acceso tiene sentido.
  abortarSiCancelado();
  const acceso = await accesoRemoto(plantacionId);
  if (esPullSinDatos(acceso)) {
    syncLog.info(`Pull abortado (${acceso.estado}):`, plantacionId);
    return acceso;
  }
  syncLog.info('Pull starting for plantation:', plantacionId);
  const inicio = Date.now();
  // La metadata es un solo UPDATE: no hay nada que medir ahí.
  await pullPlantationMetadata(plantacionId);
  const divergentes = await conDuracion(DOWNLOAD_PHASE.parcelas, () => pullParcelas(plantacionId, onProgress));
  const borrados = await borradosPorTipo(plantacionId);
  const grupos = await conDuracion(DOWNLOAD_PHASE.groups, () => pullGroups(plantacionId, borrados.grupos, onProgress));
  await conDuracion(DOWNLOAD_PHASE.usuarios, () => pullPlantationUsers(plantacionId, onProgress));
  await conDuracion(DOWNLOAD_PHASE.especiesPlantacion, () => pullPlantationSpecies(plantacionId, onProgress));
  if (grupos.ids.length > 0) {
    // Aunque falle a mitad: los lotes ya commiteados trajeron árboles con el prefijo del server.
    try {
      await conDuracion(DOWNLOAD_PHASE.arboles, () => pullTrees(grupos, borrados, onProgress));
    } finally {
      await reescribirSubIdsDeParcelasPendientes(divergentes);
    }
  }
  syncLog.info(`Pull total: ${Date.now() - inicio}ms`);
  return PULL_OK;
}

// El pull-to-refresh de plantaciones lo llama suelto, sin pasar por un orquestador,
// y escribe la base igual (#446). Anidado dentro de una sync el contador lo absorbe.
// El registro se aplica al final, con el estado de la plantación ya actualizado.
export const pullFromServer = marcandoActividadDeSync(
  (plantacionId: string, onProgress?: OnPhaseProgress) =>
    conRegistroDeVarados(() => correrPullFromServer(plantacionId, onProgress), false),
);
