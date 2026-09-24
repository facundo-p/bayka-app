import { eq, inArray } from 'drizzle-orm';
import { db } from '../../database/client';
import { groups, parcelas } from '../../database/schema';
import { recalcularSubIdsDelGrupo } from '../../repositories/subIdsDeArboles';
import { syncLog } from '../../utils/syncLogger';

export interface RemoteGroup {
  id: string;
  plantation_id: string;
  parcela_id: string;
  nombre: string;
  codigo: string;
  tipo: string;
  estado: string;
  usuario_creador: string;
  created_at: string;
}

export type GrupoLocal = { pendingSync: boolean; parcelaId: string; codigo: string; nombre: string };

type Etiqueta = Pick<GrupoLocal, 'codigo' | 'nombre'>;

export type Renombre = Etiqueta & { id: string; parcelaId: string; codigoAnterior: string };

export async function gruposLocales(plantacionId: string): Promise<Map<string, GrupoLocal>> {
  const filas = await db
    .select({
      id: groups.id, pendingSync: groups.pendingSync, parcelaId: groups.parcelaId,
      codigo: groups.codigo, nombre: groups.nombre,
    })
    .from(groups)
    .where(eq(groups.plantacionId, plantacionId));
  return new Map(filas.map(({ id, ...local }) => [id, local]));
}

/** Código y nombre son únicos por parcela, en local y en el server. */
const clavesUnicas = (parcelaId: string, e: Etiqueta) => [`${parcelaId}:codigo:${e.codigo}`, `${parcelaId}:nombre:${e.nombre}`];

function esRenombrado(remoto: RemoteGroup, local: GrupoLocal | undefined): local is GrupoLocal {
  if (local == null || local.pendingSync) return false;
  return local.codigo !== remoto.codigo || local.nombre !== remoto.nombre;
}

/**
 * Código y nombre que toma cada grupo renombrado en el server. Un grupo pendiente puede tener ya el
 * valor remoto (otro dispositivo lo usó primero): ahí el renombrado conserva el local, y el push del
 * pendiente recibe DUPLICATE_CODE. Si el local también lo tomó otro renombrado, queda el id.
 */
export function planDeRenombres(remotos: RemoteGroup[], locales: Map<string, GrupoLocal>): Renombre[] {
  const renombrados = remotos.filter((sg) => esRenombrado(sg, locales.get(sg.id)));
  const ids = new Set(renombrados.map((sg) => sg.id));
  const ocupadas = new Set([...locales]
    .filter(([id]) => !ids.has(id))
    .flatMap(([, g]) => clavesUnicas(g.parcelaId, g)));
  const libre = (parcelaId: string, e: Etiqueta) => clavesUnicas(parcelaId, e).every((k) => !ocupadas.has(k));

  return renombrados.map((sg) => {
    const local = locales.get(sg.id)!;
    const final = [sg, local].find((e) => libre(sg.parcela_id, e)) ?? { codigo: sg.id, nombre: sg.id };
    clavesUnicas(sg.parcela_id, final).forEach((k) => ocupadas.add(k));
    return { id: sg.id, parcelaId: sg.parcela_id, codigoAnterior: local.codigo, codigo: final.codigo, nombre: final.nombre };
  });
}

/**
 * En dos pasadas: el índice único se chequea fila por fila, y una rotación (L1→L9, L2→L1) choca si
 * un grupo toma un código que otro todavía no soltó.
 */
export async function adoptarRenombres(tx: typeof db, plan: Renombre[]): Promise<void> {
  for (const { id } of plan) {
    await tx.update(groups).set({ codigo: id, nombre: id }).where(eq(groups.id, id));
  }
  for (const { id, codigo, nombre } of plan) {
    if (codigo === id) syncLog.error(`Grupo ${id}: su código y el remoto los usan otros grupos locales`);
    await tx.update(groups).set({ codigo, nombre }).where(eq(groups.id, id));
  }
  await recalcularSubIdsRenombrados(tx, plan.filter((r) => r.codigo !== r.codigoAnterior));
}

/**
 * El pull de árboles conserva el SubID local, así que se reescribe acá. Corre después de
 * pullParcelas, con el código de parcela ya al día. No marca nada.
 */
async function recalcularSubIdsRenombrados(tx: typeof db, renombres: Renombre[]): Promise<void> {
  if (renombres.length === 0) return;
  const filas = await tx.select({ id: parcelas.id, codigo: parcelas.codigo })
    .from(parcelas).where(inArray(parcelas.id, renombres.map((r) => r.parcelaId)));
  const codigoDeParcela = new Map(filas.map((f) => [f.id, f.codigo]));
  for (const r of renombres) {
    const parcelaCodigo = codigoDeParcela.get(r.parcelaId);
    if (parcelaCodigo == null) continue;
    await recalcularSubIdsDelGrupo(tx, r.id,
      { parcelaCodigo, grupoCodigo: r.codigoAnterior },
      { parcelaCodigo, grupoCodigo: r.codigo },
    );
  }
}
