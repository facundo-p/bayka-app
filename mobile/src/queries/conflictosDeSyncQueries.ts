/**
 * Lecturas de los conflictos de sincronización (#795) para avisarlos y resolverlos:
 * cada conflicto con el árbol o el grupo tal como quedaron, que tienen el valor del
 * servidor.
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import { db } from '../database/client';
import { conflictosDeSync, groups, plantationSpecies, species, trees } from '../database/schema';
import { conflictosDePlantacion } from '../repositories/ConflictosDeSyncRepository';
import type {
  ArbolEnConflicto, ConflictoDeSync, ConflictoEnContexto, EspecieEnConflicto, GrupoEnConflicto,
} from '../types/conflictoDeSync';
import { CAMPO_EN_CONFLICTO, esCampoDeGrupo } from '../constants/conflictoDeSync';

const SIN_ESPECIES = { mia: null, servidor: null } as const;

/** Las filas de `ids`, por id. Sin ids no consulta. */
async function porId<T extends { id: string }>(
  ids: string[],
  consulta: (ids: string[]) => Promise<T[]>,
): Promise<Map<string, T>> {
  if (ids.length === 0) return new Map();
  return new Map((await consulta(ids)).map((f) => [f.id, f]));
}

const arbolesConId = (ids: string[]): Promise<ArbolEnConflicto[]> => db.select({
  id: trees.id, subId: trees.subId, posicion: trees.posicion, especieId: trees.especieId,
  latitude: trees.latitude, longitude: trees.longitude, gpsAccuracy: trees.gpsAccuracy,
  gpsCapturedAt: trees.gpsCapturedAt, fotoUrl: trees.fotoUrl,
}).from(trees).where(inArray(trees.id, ids));

const gruposConId = (ids: string[]): Promise<GrupoEnConflicto[]> => db.select({
  id: groups.id, parcelaId: groups.parcelaId, codigo: groups.codigo,
  nombre: groups.nombre, tipo: groups.tipo, estado: groups.estado,
}).from(groups).where(inArray(groups.id, ids));

const especiesConId = (ids: string[]) => db.select({ id: species.id, nombre: species.nombre, codigo: species.codigo })
  .from(species).where(inArray(species.id, ids));

type EspecieConId = EspecieEnConflicto & { id: string };

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
  especies: Map<string, EspecieConId>,
): ConflictoEnContexto {
  const arbol = esCampoDeGrupo(c.campo) ? null : arboles.get(c.entidadId) ?? null;
  const deEspecie = (id: unknown): EspecieEnConflicto | null => {
    const especie = typeof id === 'string' ? especies.get(id) : undefined;
    return especie ? { nombre: especie.nombre, codigo: especie.codigo } : null;
  };
  return {
    conflicto: c,
    arbol,
    grupo: grupos.get(c.grupoId) ?? null,
    especies: esDeEspecie(c) ? { mia: deEspecie(c.mio), servidor: deEspecie(arbol?.especieId) } : SIN_ESPECIES,
  };
}

/** Los conflictos de una plantación, por grupo y entidad. */
export async function conflictosDeSyncEnContexto(plantacionId: string): Promise<ConflictoEnContexto[]> {
  const filas = await conflictosDePlantacion(plantacionId);
  const arboles = await porId(filas.filter((c) => !esCampoDeGrupo(c.campo)).map((c) => c.entidadId), arbolesConId);
  const grupos = await porId([...new Set(filas.map((c) => c.grupoId))], gruposConId);
  const especies = await porId(idsDeEspecies(filas, arboles), especiesConId);
  return filas.map((c) => enContexto(c, arboles, grupos, especies));
}

export async function arbolExiste(treeId: string): Promise<boolean> {
  const [fila] = await db.select({ n: count() }).from(trees).where(eq(trees.id, treeId));
  return (fila?.n ?? 0) > 0;
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
