/**
 * Lecturas de los conflictos de sincronización (#795) para avisarlos y resolverlos:
 * cada conflicto con el árbol o el grupo tal como quedaron, que tienen el valor del
 * servidor.
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '../database/client';
import { conflictosDeSync, groups, plantationSpecies, species, trees } from '../database/schema';
import { conflictosDePlantacion, type ConflictoDeSync } from '../repositories/ConflictosDeSyncRepository';
import { CAMPO_EN_CONFLICTO, esCampoDeGrupo } from '../constants/conflictoDeSync';

export interface ArbolEnConflicto {
  id: string;
  subId: string;
  posicion: number;
  especieId: string | null;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
  gpsCapturedAt: string | null;
  fotoUrl: string | null;
}

export interface GrupoEnConflicto {
  id: string;
  parcelaId: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
}

export interface EspecieEnConflicto {
  nombre: string;
  codigo: string;
}

/** Un conflicto con lo que hay hoy: `arbol` es null en los de grupo o si el árbol se borró. */
export interface ConflictoDeSyncEnContexto {
  conflicto: ConflictoDeSync;
  arbol: ArbolEnConflicto | null;
  grupo: GrupoEnConflicto | null;
  /** En los de especie: la propia y la del servidor, si están en el catálogo. */
  especies: { mia: EspecieEnConflicto | null; servidor: EspecieEnConflicto | null };
}

const SIN_ESPECIES = { mia: null, servidor: null } as const;

async function arbolesPorId(ids: string[]): Promise<Map<string, ArbolEnConflicto>> {
  if (ids.length === 0) return new Map();
  const filas = await db.select({
    id: trees.id, subId: trees.subId, posicion: trees.posicion, especieId: trees.especieId,
    latitude: trees.latitude, longitude: trees.longitude, gpsAccuracy: trees.gpsAccuracy,
    gpsCapturedAt: trees.gpsCapturedAt, fotoUrl: trees.fotoUrl,
  }).from(trees).where(inArray(trees.id, ids));
  return new Map(filas.map((f) => [f.id, f]));
}

async function gruposPorId(ids: string[]): Promise<Map<string, GrupoEnConflicto>> {
  if (ids.length === 0) return new Map();
  const filas = await db.select({
    id: groups.id, parcelaId: groups.parcelaId, codigo: groups.codigo,
    nombre: groups.nombre, tipo: groups.tipo, estado: groups.estado,
  }).from(groups).where(inArray(groups.id, ids));
  return new Map(filas.map((f) => [f.id, f]));
}

async function especiesPorId(ids: string[]): Promise<Map<string, EspecieEnConflicto>> {
  if (ids.length === 0) return new Map();
  const filas = await db.select({ id: species.id, nombre: species.nombre, codigo: species.codigo })
    .from(species).where(inArray(species.id, ids));
  return new Map(filas.map(({ id, ...especie }) => [id, especie]));
}

const esDeEspecie = (c: ConflictoDeSync) => c.campo === CAMPO_EN_CONFLICTO.especie;

/** Las especies que nombran los conflictos de especie, de los dos lados. */
function idsDeEspecies(filas: ConflictoDeSync[], arboles: Map<string, ArbolEnConflicto>): string[] {
  const ids = filas.filter(esDeEspecie).flatMap((c) => [c.mio, arboles.get(c.entidadId)?.especieId]);
  return [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
}

function enContexto(
  c: ConflictoDeSync,
  arboles: Map<string, ArbolEnConflicto>,
  grupos: Map<string, GrupoEnConflicto>,
  especies: Map<string, EspecieEnConflicto>,
): ConflictoDeSyncEnContexto {
  const arbol = esCampoDeGrupo(c.campo) ? null : arboles.get(c.entidadId) ?? null;
  const deEspecie = (id: unknown) => (typeof id === 'string' ? especies.get(id) ?? null : null);
  return {
    conflicto: c,
    arbol,
    grupo: grupos.get(c.grupoId) ?? null,
    especies: esDeEspecie(c) ? { mia: deEspecie(c.mio), servidor: deEspecie(arbol?.especieId) } : SIN_ESPECIES,
  };
}

/** Los conflictos de una plantación, por grupo y entidad. */
export async function conflictosDeSyncEnContexto(plantacionId: string): Promise<ConflictoDeSyncEnContexto[]> {
  const filas = await conflictosDePlantacion(plantacionId);
  const arboles = await arbolesPorId(filas.filter((c) => !esCampoDeGrupo(c.campo)).map((c) => c.entidadId));
  const grupos = await gruposPorId([...new Set(filas.map((c) => c.grupoId))]);
  const especies = await especiesPorId(idsDeEspecies(filas, arboles));
  return filas.map((c) => enContexto(c, arboles, grupos, especies));
}

export async function especieEnPlantacion(plantacionId: string, especieId: string): Promise<boolean> {
  const [fila] = await db.select({ n: count() }).from(plantationSpecies)
    .where(and(eq(plantationSpecies.plantacionId, plantacionId), eq(plantationSpecies.especieId, especieId)));
  return (fila?.n ?? 0) > 0;
}

/** Cuántos conflictos sin resolver tiene cada plantación. */
export function conflictosDeSyncPorPlantacion(): Promise<{ plantacionId: string; cantidad: number }[]> {
  return db.select({ plantacionId: conflictosDeSync.plantacionId, cantidad: count() })
    .from(conflictosDeSync).groupBy(conflictosDeSync.plantacionId);
}

/** Qué árbol o qué dato del grupo tiene un conflicto sin resolver. */
export function conflictosDeSyncDeGrupo(grupoId: string): Promise<Pick<ConflictoDeSync, 'entidadId' | 'campo'>[]> {
  return db.select({ entidadId: conflictosDeSync.entidadId, campo: conflictosDeSync.campo })
    .from(conflictosDeSync).where(eq(conflictosDeSync.grupoId, grupoId));
}
