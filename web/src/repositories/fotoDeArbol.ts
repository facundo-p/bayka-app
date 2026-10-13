/**
 * Quitar la foto de un árbol por la RPC `quitar_fotos_arboles` (#903). Viaja
 * con la foto que se estaba viendo (la base): si alguien la reemplazó mientras
 * tanto, el server no la quita y devuelve la nueva.
 */
import { errorDeSupabase } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';
import { ErrorDeEdicion } from './edicionDePlantacion';

const RPC_QUITAR_FOTOS_ARBOLES = 'quitar_fotos_arboles';

export const MENSAJE_QUITAR_FOTO = {
  rechazada: 'No se pudo eliminar la foto: la plantación ya no admite cambios.',
  cambiada:
    'Alguien cambió la foto desde otro lado: ahora se muestra la nueva. Revisala antes de eliminarla.',
  generico: 'No se pudo eliminar la foto. Probá de nuevo.',
} as const;

/** La foto cambió en el server: `vigente` es la que quedó. */
export class FotoCambiadaError extends ErrorDeEdicion {
  readonly vigente: string;
  constructor(vigente: string) {
    super(MENSAJE_QUITAR_FOTO.cambiada);
    this.name = 'FotoCambiadaError';
    this.vigente = vigente;
  }
}

type RespuestaQuitar = {
  success?: boolean;
  rechazados?: string[];
  conservados?: { arboles?: Array<{ id: string; foto_url: string }> };
} | null;

/** Sin error, el árbol quedó sin foto: también si alguien ya la había quitado. */
export async function quitarFotoDeArbol(treeId: string, fotoVista: string): Promise<void> {
  const { data, error } = await supabase.rpc(RPC_QUITAR_FOTOS_ARBOLES, {
    p_arboles: [treeId],
    p_bases: { [treeId]: fotoVista },
  });
  if (error) throw errorDeSupabase(error);
  const respuesta = data as RespuestaQuitar;
  if (!respuesta?.success) throw new ErrorDeEdicion(MENSAJE_QUITAR_FOTO.generico);
  if (respuesta.rechazados?.includes(treeId))
    throw new ErrorDeEdicion(MENSAJE_QUITAR_FOTO.rechazada);
  const conservada = respuesta.conservados?.arboles?.find((arbol) => arbol.id === treeId);
  if (conservada) throw new FotoCambiadaError(conservada.foto_url);
}
