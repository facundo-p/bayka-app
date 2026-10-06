import type { SubtipoEspecie, TipoEspecie } from '../../../shared/tiposEspecie';
import { porNombre } from '../lib/ordenEspecies';
import { supabase } from '../lib/supabase';
import { contarOLanzar } from './conteo';
import { leerPaginado } from './leerPaginado';

export type EspecieCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  nombreCientifico: string | null;
};

/** Especie con su tipo y subtipo (#752): lo que muestra y edita la pantalla de Especies. */
export type EspecieClasificada = EspecieCatalogo & {
  tipo: TipoEspecie;
  subtipo: SubtipoEspecie;
};

/** Especie del catálogo + uso agregado a nivel organización. */
export type EspecieConCatalogoUso = EspecieClasificada & {
  plantaciones: number;
  arboles: number;
};

/** Especie habilitada en una plantación. La app las ordena por nombre (#635). */
export type EspecieDePlantacion = EspecieCatalogo;

/** Especie habilitada + si tiene árboles registrados (bloquea quitarla). */
export type EspecieConUso = EspecieDePlantacion & { tieneArboles: boolean };

type FilaEspecie = {
  id: string;
  codigo: string;
  nombre: string;
  nombre_cientifico: string | null;
};

type FilaEspecieClasificada = FilaEspecie & { tipo: TipoEspecie; subtipo: SubtipoEspecie };

/** Fila del join plantation_species → species (embed de PostgREST). */
type FilaAsignada = {
  species_id: string;
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

const COLUMNAS_ESPECIE = 'id, codigo, nombre, nombre_cientifico';

async function leerCatalogo<F extends FilaEspecie>(columnas: string): Promise<F[]> {
  const { data, error } = await supabase
    .from('species')
    .select(columnas)
    .order('codigo', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as F[];
}

export async function listarCatalogo(): Promise<EspecieCatalogo[]> {
  return (await leerCatalogo<FilaEspecie>(COLUMNAS_ESPECIE)).map(mapearEspecie);
}

/** El catálogo con tipo y subtipo, para la pantalla de Especies. */
async function listarCatalogoClasificado(): Promise<EspecieClasificada[]> {
  const filas = await leerCatalogo<FilaEspecieClasificada>(`${COLUMNAS_ESPECIE}, tipo, subtipo`);
  return filas.map((fila) => ({ ...mapearEspecie(fila), tipo: fila.tipo, subtipo: fila.subtipo }));
}

function mapearAsignada(fila: FilaAsignada): EspecieDePlantacion {
  return {
    id: fila.species_id,
    codigo: fila.species?.codigo ?? '',
    nombre: fila.species?.nombre ?? '',
    nombreCientifico: fila.species?.nombre_cientifico ?? null,
  };
}

/** Especies habilitadas de la plantación, por nombre: el orden de la botonera en la app (#635). */
export async function listarEspeciesDePlantacion(
  plantationId: string,
): Promise<EspecieDePlantacion[]> {
  const { data, error } = await supabase
    .from('plantation_species')
    .select('species_id, species(id, codigo, nombre, nombre_cientifico)')
    .eq('plantation_id', plantationId);
  if (error) throw new Error(error.message);
  // Embed many-to-one: llega como objeto, no array (cliente sin typegen).
  return porNombre(((data ?? []) as unknown as FilaAsignada[]).map(mapearAsignada));
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
    supabase
      .from('plantation_species')
      .select('species_id')
      .order('plantation_id')
      .order('species_id')
      .range(desde, hasta),
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

/** Catálogo + uso: count head de árboles por especie en paralelo (~14 especies, costo marginal); mantiene el orden por código. */
export async function listarCatalogoConUso(): Promise<EspecieConCatalogoUso[]> {
  const [catalogo, plantacionesPorEspecie] = await Promise.all([
    listarCatalogoClasificado(),
    contarPlantacionesPorEspecie(),
  ]);
  const arboles = await Promise.all(catalogo.map((especie) => contarArbolesDeEspecie(especie.id)));
  return catalogo.map((especie, indice) => ({
    ...especie,
    plantaciones: plantacionesPorEspecie.get(especie.id) ?? 0,
    arboles: arboles[indice] ?? 0,
  }));
}

/** Plantación que habilita una especie, con sus árboles de esa especie. */
export type PlantacionDeEspecie = {
  id: string;
  nombre: string;
  arboles: number;
};

/** Fila del join plantation_species → plantations (embed de PostgREST). */
type FilaPlantacionDeEspecie = {
  plantation_id: string;
  plantations: { id: string; lugar: string } | null;
};

/** Árboles de una especie dentro de una plantación (count head vía groups). */
async function contarArbolesEnPlantacion(plantationId: string, speciesId: string): Promise<number> {
  const { count, error } = await supabase
    .from('trees')
    .select('id, groups!inner(plantation_id)', { count: 'exact', head: true })
    .eq('groups.plantation_id', plantationId)
    .eq('species_id', speciesId);
  return contarOLanzar(count, error);
}

/** Dónde está habilitada una especie, de mayor a menor cantidad de árboles. */
export async function listarPlantacionesDeEspecie(
  especieId: string,
): Promise<PlantacionDeEspecie[]> {
  const { data, error } = await supabase
    .from('plantation_species')
    .select('plantation_id, plantations(id, lugar)')
    .eq('species_id', especieId);
  if (error) throw new Error(error.message);
  // Embed many-to-one: llega como objeto, no array (cliente sin typegen).
  const filas = (data ?? []) as unknown as FilaPlantacionDeEspecie[];
  const arboles = await Promise.all(
    filas.map((fila) => contarArbolesEnPlantacion(fila.plantation_id, especieId)),
  );
  return filas
    .map((fila, indice) => ({
      id: fila.plantation_id,
      nombre: fila.plantations?.lugar ?? '',
      arboles: arboles[indice] ?? 0,
    }))
    .sort((a, b) => b.arboles - a.arboles);
}
