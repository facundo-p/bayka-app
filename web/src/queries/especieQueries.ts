import { supabase } from '../lib/supabase';
import { contarOLanzar } from './conteo';
import { leerPaginado } from './leerPaginado';

export type EspecieCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  nombreCientifico: string | null;
};

/** Especie del catálogo + uso agregado a nivel organización. */
export type EspecieConCatalogoUso = EspecieCatalogo & {
  plantaciones: number;
  arboles: number;
};

/** Campos editables de una especie (los que expone el formulario de alta/edición). */
export type EspecieEditable = EspecieCatalogo;

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
  // Embed many-to-one: llega como objeto, no array (cliente sin typegen).
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

/** Especies + uso: un count head por especie en paralelo (pocas por plantación, costo marginal). */
export async function listarEspeciesConUso(plantationId: string): Promise<EspecieConUso[]> {
  const especies = await listarEspeciesDePlantacion(plantationId);
  const usos = await Promise.all(
    especies.map((especie) => tieneArbolesEspecie(plantationId, especie.id)),
  );
  return especies.map((especie, indice) => ({ ...especie, tieneArboles: usos[indice] }));
}

/**
 * Cuántas plantaciones habilitan cada especie (clave = species_id): "se usa" = habilitada, no con árboles.
 * Lectura barata y RLS-safe, contando en cliente en vez de un count-por-especie en el servidor.
 */
async function contarPlantacionesPorEspecie(): Promise<Map<string, number>> {
  const filas = await leerPaginado<{ species_id: string }>((desde, hasta) =>
    supabase.from('plantation_species').select('species_id').range(desde, hasta),
  );
  const conteos = new Map<string, number>();
  for (const fila of filas) {
    conteos.set(fila.species_id, (conteos.get(fila.species_id) ?? 0) + 1);
  }
  return conteos;
}

/** Total de árboles de una especie (count head, scope por RLS). */
async function contarArbolesDeEspecie(speciesId: string): Promise<number> {
  const { count, error } = await supabase
    .from('trees')
    .select('id', { count: 'exact', head: true })
    .eq('species_id', speciesId);
  return contarOLanzar(count, error);
}

/** Catálogo + uso: count head de árboles por especie en paralelo (~14 especies, costo marginal); mantiene el orden de `listarCatalogo`. */
export async function listarCatalogoConUso(): Promise<EspecieConCatalogoUso[]> {
  const [catalogo, plantacionesPorEspecie] = await Promise.all([
    listarCatalogo(),
    contarPlantacionesPorEspecie(),
  ]);
  const arboles = await Promise.all(
    catalogo.map((especie) => contarArbolesDeEspecie(especie.id)),
  );
  return catalogo.map((especie, indice) => ({
    ...especie,
    plantaciones: plantacionesPorEspecie.get(especie.id) ?? 0,
    arboles: arboles[indice] ?? 0,
  }));
}
