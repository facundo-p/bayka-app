import { supabase } from '../lib/supabase';
import { listarCatalogoClasificado, type EspecieCatalogo } from './especieQueries';

/** Especie científica (#753): agrupa las especies que son la misma planta con otro nombre común. */
export type EspecieCientifica = { id: string; nombre: string };

/** Especie del catálogo que una especie científica agrupa. */
export type EspecieAgrupada = Pick<EspecieCatalogo, 'id' | 'codigo' | 'nombre'>;

export type EspecieCientificaConEspecies = EspecieCientifica & { especies: EspecieAgrupada[] };

/** Solo id y nombre, por nombre: lo que busca ⌘K. */
export async function listarNombresCientificos(): Promise<EspecieCientifica[]> {
  const { data, error } = await supabase
    .from('especies_cientificas')
    .select('id, nombre')
    .order('nombre', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EspecieCientifica[];
}

/**
 * Cada especie científica con las especies que agrupa, por nombre. El catálogo es chico (decenas):
 * se agrupa en cliente en vez de embeber species, y así la misma lectura sirve al selector.
 */
export async function listarEspeciesCientificas(): Promise<EspecieCientificaConEspecies[]> {
  const [cientificas, catalogo] = await Promise.all([
    listarNombresCientificos(),
    listarCatalogoClasificado(),
  ]);
  const porCientifica = new Map<string, EspecieAgrupada[]>();
  for (const { id, codigo, nombre, especieCientificaId } of catalogo) {
    if (!especieCientificaId) continue;
    const agrupadas = porCientifica.get(especieCientificaId) ?? [];
    agrupadas.push({ id, codigo, nombre });
    porCientifica.set(especieCientificaId, agrupadas);
  }
  return cientificas.map((cientifica) => ({
    ...cientifica,
    especies: porCientifica.get(cientifica.id) ?? [],
  }));
}
