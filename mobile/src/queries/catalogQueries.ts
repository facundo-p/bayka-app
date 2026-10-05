/**
 * Catalog query functions — server catalog discovery and local plantation ID lookup.
 * Role-gated: admin sees all org plantations, tecnico sees only assigned ones.
 */
import { supabase } from '../supabase/client';
import { db } from '../database/client';
import { plantations, groups, borradosPendientes } from '../database/schema';
import { countCambiosDeEspecies } from '../repositories/CambiosDeEspeciesRepository';
import { countAltasDeTecnicos } from '../repositories/TecnicosDePlantacionRepository';
import { eq, and, count } from 'drizzle-orm';
import { fetchAllRows } from '../services/sync/paginate';
import { ESTADO_GRUPO, esArchivada } from '../constants/estados';
import { countFotosSinSubirDePlantacion, countPendingParcelas } from './pendingSyncQueries';

export type ServerPlantation = {
  id: string;
  organizacion_id: string;
  lugar: string;
  periodo: string;
  estado: string;
  creado_por: string;
  created_at: string;
  // Visibilidad administrada desde la web; true si el server no trae la columna.
  visible_in_app: boolean;
  group_count: number;
  tree_count: number;
};

/**
 * Las archivadas no se ofrecen para descargar (#477). Se filtra acá y no con
 * `.is('archivada_en', null)`: con `select('*')` un server sin la columna sigue andando.
 */
function sinArchivadas(rows: any[]): any[] {
  return rows.filter((p) => !esArchivada({ archivadaEn: p.archivada_en ?? null }));
}

const RPC_CATALOGO_CONTEOS = 'catalogo_conteos';

type Conteos = { grupos: number; arboles: number };

/** Grupos y árboles por plantación, contados en el server (#682). Sin grupos, no hay entrada. */
async function contarPorPlantacion(plantationIds: string[]): Promise<Map<string, Conteos>> {
  const { data, error } = await supabase.rpc(RPC_CATALOGO_CONTEOS, { p_ids: plantationIds });
  if (error) throw error;
  const filas = (data ?? []) as { plantation_id: string; grupos: number; arboles: number }[];
  return new Map(filas.map((f) => [f.plantation_id, { grupos: Number(f.grupos), arboles: Number(f.arboles) }]));
}

/**
 * Fetches plantations from Supabase with role-based filtering.
 * - Admin: all plantations in the organization
 * - Tecnico: only plantations assigned via plantation_users
 * Also fetches subgroup and tree counts per plantation and merges them.
 * Throws if any Supabase query returns an error.
 */
export async function getServerCatalog(
  isAdmin: boolean,
  userId: string,
  organizacionId: string
): Promise<ServerPlantation[]> {
  let remotePlantations: any[];

  if (isAdmin) {
    const { data, error } = await fetchAllRows<any>(() =>
      supabase
        .from('plantations')
        .select('*')
        .eq('organizacion_id', organizacionId)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    remotePlantations = sinArchivadas(data ?? []);
  } else {
    const { data: puData, error: puError } = await fetchAllRows<any>(() =>
      supabase.from('plantation_users').select('plantation_id').eq('user_id', userId)
    );

    if (puError) throw puError;

    const assignedIds = (puData ?? []).map((row: any) => row.plantation_id);
    if (assignedIds.length === 0) return [];

    const { data, error } = await fetchAllRows<any>(() =>
      supabase
        .from('plantations')
        .select('*')
        .in('id', assignedIds)
        .order('created_at', { ascending: false })
    );

    if (error) throw error;
    remotePlantations = sinArchivadas(data ?? []);
  }

  if (remotePlantations.length === 0) return [];

  const conteos = await contarPorPlantacion(remotePlantations.map((p: any) => p.id));

  return remotePlantations.map((p: any): ServerPlantation => ({
    id: p.id,
    organizacion_id: p.organizacion_id,
    lugar: p.lugar,
    periodo: p.periodo,
    estado: p.estado,
    creado_por: p.creado_por,
    created_at: p.created_at,
    visible_in_app: p.visible_in_app ?? true,
    group_count: conteos.get(p.id)?.grupos ?? 0,
    tree_count: conteos.get(p.id)?.arboles ?? 0,
  }));
}

/** Returns a Set of plantation IDs stored in local SQLite. */
export async function getLocalPlantationIds(): Promise<Set<string>> {
  const rows = await db.select({ id: plantations.id }).from(plantations);
  return new Set(rows.map((r) => r.id));
}

export type UnsyncedSummary = {
  activaCount: number;
  finalizadaCount: number;
};

/**
 * Returns counts of groups with pending local changes for a plantation.
 * Does NOT filter by usuarioCreador — counts ALL groups regardless of
 * which technician created them.
 */
export async function getUnsyncedGroupSummary(
  plantacionId: string
): Promise<UnsyncedSummary> {
  const rows = await db
    .select({ estado: groups.estado, cnt: count() })
    .from(groups)
    .where(
      and(
        eq(groups.plantacionId, plantacionId),
        eq(groups.pendingSync, true)
      )
    )
    .groupBy(groups.estado);

  return {
    activaCount: rows.find((r) => r.estado === ESTADO_GRUPO.activa)?.cnt ?? 0,
    finalizadaCount: rows.find((r) => r.estado === ESTADO_GRUPO.finalizada)?.cnt ?? 0,
  };
}

/** Todo lo que quedó sin subir en una plantación: lo que se pierde al eliminarla del dispositivo (#478). */
export type ResumenDePendientes = UnsyncedSummary & {
  /** Incluye tombstones: un borrado de parcela sin subir también se pierde. */
  parcelas: number;
  fotos: number;
  /** Borrados de grupos y árboles sin propagar al server. */
  borrados: number;
  /** Altas y bajas de especies sin subir (#635). */
  especies: number;
  /** Técnicos asignados en el teléfono sin subir (#636). */
  tecnicos: number;
};

async function countBorradosPendientes(plantacionId: string): Promise<number> {
  const rows = await db
    .select({ cnt: count() })
    .from(borradosPendientes)
    .where(eq(borradosPendientes.plantacionId, plantacionId));
  return rows[0]?.cnt ?? 0;
}

export async function getResumenDePendientes(plantacionId: string): Promise<ResumenDePendientes> {
  const [grupos, parcelas, fotos, borrados, especies, tecnicos] = await Promise.all([
    getUnsyncedGroupSummary(plantacionId),
    countPendingParcelas({ plantacionId }),
    countFotosSinSubirDePlantacion(plantacionId),
    countBorradosPendientes(plantacionId),
    countCambiosDeEspecies(plantacionId),
    countAltasDeTecnicos(plantacionId),
  ]);
  return { ...grupos, parcelas: parcelas[0]?.cnt ?? 0, fotos: fotos[0]?.cnt ?? 0, borrados, especies, tecnicos };
}

/** Lo que el aviso de "eliminar del dispositivo" necesita de la plantación local. Null si no está. */
export async function getPlantacionParaEliminarDelDispositivo(
  plantacionId: string,
): Promise<{ lugar: string; eliminadaEnServidorEn: string | null } | null> {
  const rows = await db
    .select({ lugar: plantations.lugar, eliminadaEnServidorEn: plantations.eliminadaEnServidorEn })
    .from(plantations)
    .where(eq(plantations.id, plantacionId));
  return rows[0] ?? null;
}
