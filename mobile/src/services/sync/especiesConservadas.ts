/**
 * Cierre del push de un grupo (#679). Si el server tiene otra especie que la base
 * del árbol, gana el server: `sync_subgroup` se queda con la suya y la devuelve en
 * `conservadas`, haya cambiado o no acá.
 */
import {
  adoptarEspeciesDelServidor,
  cambiadaAca,
  confirmarEspeciesSubidas,
  type EspecieDelServidor,
  type EspecieSubida,
} from '../../repositories/TreeRepository';
import { asegurarEspecies } from './catalogoDeEspecies';

type Conservada = { id: string; species_id: string };

function aAdoptar(conservadas: Conservada[], subidaPorId: Map<string, EspecieSubida>): EspecieDelServidor[] {
  return conservadas.flatMap((conservada) => {
    const subida = subidaPorId.get(conservada.id);
    return subida ? [{ id: conservada.id, especieId: conservada.species_id, especieSubida: subida.especieId ?? null }] : [];
  });
}

/**
 * La especie subida pasa a ser la base y los árboles conservados adoptan la del
 * server. Devuelve cuántos de esos había cambiado este dispositivo, para avisarlo.
 * Un server sin 065 no manda `conservadas`.
 */
export async function asentarEspeciesSubidas(subidas: EspecieSubida[], respuesta: unknown): Promise<number> {
  const conservadas = (respuesta as { conservadas?: Conservada[] } | null)?.conservadas ?? [];
  const subidaPorId = new Map(subidas.map((subida) => [subida.id, subida]));
  const delServidor = aAdoptar(conservadas, subidaPorId);
  // La base de un conservado no se confirma: si esto se corta antes de adoptarlo, el
  // grupo sigue pendiente y el reintento lo vuelve a recibir. Uno que no se puede
  // adoptar (falta la especie) lo adopta el pull siguiente, sin aviso.
  const ids = new Set(delServidor.map((arbol) => arbol.id));
  await confirmarEspeciesSubidas(subidas.filter((subida) => !ids.has(subida.id)));
  if (delServidor.length === 0) return 0;
  // El pull de antes no baja la especie de un grupo pendiente: puede faltar acá.
  await asegurarEspecies(delServidor.map((arbol) => arbol.especieId));
  const adoptados = await adoptarEspeciesDelServidor(delServidor);
  return adoptados.filter((id) => cambiadaAca(subidaPorId.get(id)!)).length;
}
