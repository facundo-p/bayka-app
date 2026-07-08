import { supabase } from '../lib/supabase';

/** Par especie + orden visual, para los swaps de reordenamiento. */
export type OrdenEspecie = { speciesId: string; ordenVisual: number };

/** Habilita la especie en la plantación al final de la lista (orden dado). */
export async function agregarEspecie(
  plantationId: string,
  speciesId: string,
  ordenVisual: number,
): Promise<void> {
  const { error } = await supabase.from('plantation_species').insert({
    plantation_id: plantationId,
    species_id: speciesId,
    orden_visual: ordenVisual,
  });
  if (error) throw new Error(error.message);
}

/**
 * Deshabilita la especie en la plantación. La pantalla bloquea esta acción
 * si la especie tiene árboles registrados (paridad con mobile).
 */
export async function quitarEspecie(plantationId: string, speciesId: string): Promise<void> {
  const { error } = await supabase
    .from('plantation_species')
    .delete()
    .eq('plantation_id', plantationId)
    .eq('species_id', speciesId);
  if (error) throw new Error(error.message);
}

/**
 * Aplica una acción masiva del checklist en dos batches: inserta las especies
 * a habilitar (orden_visual correlativo desde `ordenInicial`) y borra las que
 * se quitan en un solo delete. La decisión de qué habilitar/quitar (respetando
 * las bloqueadas por árboles) vive en `speciesChecklistSelection`, no acá: este
 * repo solo ejecuta, sin leer estado ni lógica de negocio.
 */
export async function sincronizarEspecies(
  plantationId: string,
  idsHabilitar: string[],
  idsQuitar: string[],
  ordenInicial: number,
): Promise<void> {
  if (idsHabilitar.length > 0) {
    const filas = idsHabilitar.map((speciesId, indice) => ({
      plantation_id: plantationId,
      species_id: speciesId,
      orden_visual: ordenInicial + indice,
    }));
    const { error } = await supabase.from('plantation_species').insert(filas);
    if (error) throw new Error(error.message);
  }
  if (idsQuitar.length > 0) {
    const { error } = await supabase
      .from('plantation_species')
      .delete()
      .eq('plantation_id', plantationId)
      .in('species_id', idsQuitar);
    if (error) throw new Error(error.message);
  }
}

async function actualizarOrden(
  plantationId: string,
  speciesId: string,
  ordenVisual: number,
): Promise<void> {
  const { error } = await supabase
    .from('plantation_species')
    .update({ orden_visual: ordenVisual })
    .eq('plantation_id', plantationId)
    .eq('species_id', speciesId);
  if (error) throw new Error(error.message);
}

/** Sube/baja la especie intercambiando su orden_visual con el de la vecina. */
export async function moverEspecie(
  plantationId: string,
  especie: OrdenEspecie,
  vecina: OrdenEspecie,
): Promise<void> {
  await actualizarOrden(plantationId, especie.speciesId, vecina.ordenVisual);
  await actualizarOrden(plantationId, vecina.speciesId, especie.ordenVisual);
}
