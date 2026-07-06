import { supabase } from '../lib/supabase';

/** Especie del catálogo global (tabla `species`). */
export type EspecieCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  nombreCientifico: string | null;
};

/** Especie habilitada en una plantación, con su orden de aparición en la app. */
export type EspecieDePlantacion = EspecieCatalogo & { ordenVisual: number };

/** Especie habilitada + si tiene árboles registrados (bloquea quitarla). */
export type EspecieConUso = EspecieDePlantacion & { tieneArboles: boolean };

type FilaEspecie = {
  id: string;
  codigo: string;
  nombre: string;
  nombre_cientifico: string | null;
};

/** Fila del join plantation_species → species (embed de PostgREST). */
type FilaAsignada = {
  species_id: string;
  orden_visual: number;
  species: FilaEspecie | null;
};

function mapearEspecie(fila: FilaEspecie): EspecieCatalogo {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    nombreCientifico: fila.nombre_cientifico,
  };
}

/** Catálogo global completo, ordenado por código. */
export async function listarCatalogo(): Promise<EspecieCatalogo[]> {
  const { data, error } = await supabase
    .from('species')
    .select('id, codigo, nombre, nombre_cientifico')
    .order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FilaEspecie[]).map(mapearEspecie);
}

function mapearAsignada(fila: FilaAsignada): EspecieDePlantacion {
  return {
    id: fila.species_id,
    codigo: fila.species?.codigo ?? '',
    nombre: fila.species?.nombre ?? '',
    nombreCientifico: fila.species?.nombre_cientifico ?? null,
    ordenVisual: fila.orden_visual,
  };
}

/** Especies habilitadas de la plantación, por orden visual. */
export async function listarEspeciesDePlantacion(
  plantationId: string,
): Promise<EspecieDePlantacion[]> {
  const { data, error } = await supabase
    .from('plantation_species')
    .select('species_id, orden_visual, species(id, codigo, nombre, nombre_cientifico)')
    .eq('plantation_id', plantationId)
    .order('orden_visual', { ascending: true });
  if (error) throw new Error(error.message);
  // El cliente sin typegen tipa el embed como array, pero la FK species_id →
  // species es many-to-one: en runtime llega un objeto.
  return ((data ?? []) as unknown as FilaAsignada[]).map(mapearAsignada);
}

/** Paridad con `hasTreesForSpecies` de mobile: count head trees → groups. */
async function tieneArbolesEspecie(plantationId: string, speciesId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('trees')
    .select('id, groups!inner(plantation_id)', { count: 'exact', head: true })
    .eq('groups.plantation_id', plantationId)
    .eq('species_id', speciesId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Especies habilitadas + uso. Un count head por especie en paralelo: una
 * plantación habilita pocas especies, así que el costo es marginal (mismo
 * criterio que los counts del listado de plantaciones).
 */
export async function listarEspeciesConUso(plantationId: string): Promise<EspecieConUso[]> {
  const especies = await listarEspeciesDePlantacion(plantationId);
  const usos = await Promise.all(
    especies.map((especie) => tieneArbolesEspecie(plantationId, especie.id)),
  );
  return especies.map((especie, indice) => ({ ...especie, tieneArboles: usos[indice] }));
}
