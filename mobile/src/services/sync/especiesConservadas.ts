/**
 * Cierre del push de un grupo (#679). Si el árbol cambió acá y en el server, gana
 * el server: `sync_subgroup` se queda con su especie y la devuelve en `conservadas`.
 */
import {
  adoptarEspeciesDelServidor,
  confirmarEspeciesSubidas,
  type EspecieSubida,
} from '../../repositories/TreeRepository';
import { asegurarEspecies } from './catalogoDeEspecies';

type Conservada = { id: string; species_id: string };

/**
 * La especie subida pasa a ser la base, y los árboles conservados adoptan la del
 * server. Devuelve cuántos la adoptaron, para avisarlo. Un server sin 065 no manda
 * `conservadas`.
 */
export async function asentarEspeciesSubidas(subidas: EspecieSubida[], respuesta: unknown): Promise<number> {
  await confirmarEspeciesSubidas(subidas);
  const conservadas = (respuesta as { conservadas?: Conservada[] } | null)?.conservadas ?? [];
  if (conservadas.length === 0) return 0;
  // El pull de antes no baja la especie de un grupo pendiente: puede faltar acá.
  await asegurarEspecies(conservadas.map((c) => c.species_id));
  return adoptarEspeciesDelServidor(conservadas.map((c) => ({ id: c.id, especieId: c.species_id })));
}
