/**
 * Cambio de especie de un árbol ya cargado por la RPC `cambiar_especie_arbol`
 * (#679). Viaja con la especie que mostraba el panel (la base): si alguien la
 * cambió desde otro lado mientras tanto, el server no la pisa.
 */
import { errorDeSupabase } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';
import { NOMBRE_SIN_IDENTIFICAR } from '../queries/especiesConstantes';
import { ERROR_EDICION, ErrorDeEdicion, MENSAJE_RECHAZO_EDICION } from './edicionDePlantacion';

const RPC_CAMBIAR_ESPECIE_ARBOL = 'cambiar_especie_arbol';

export const ERROR_CAMBIO_DE_ESPECIE = {
  conflicto: ERROR_EDICION.conflicto,
  noAutorizado: ERROR_EDICION.noAutorizado,
  finalizada: ERROR_EDICION.finalizada,
  archivada: ERROR_EDICION.archivada,
  especieNoHabilitada: 'ESPECIE_NO_HABILITADA',
} as const;

const MENSAJE_RECHAZO: Record<string, string> = {
  ...MENSAJE_RECHAZO_EDICION,
  [ERROR_CAMBIO_DE_ESPECIE.noAutorizado]: 'Tu usuario no tiene permisos para editar este árbol.',
  [ERROR_CAMBIO_DE_ESPECIE.especieNoHabilitada]:
    'Esa especie ya no está habilitada en la plantación.',
};

const MENSAJE_RECHAZO_GENERICO = 'No se pudo cambiar la especie. Probá de nuevo.';

export const mensajeConflictoDeEspecie = (especieServidor: string) =>
  `Alguien cambió la especie desde otro lado mientras la editabas: ahora es ${especieServidor}. ` +
  'Revisala y volvé a cambiarla si hace falta.';

/** La especie que quedó en el árbol: la elegida, o la del server si chocó. */
export type EspecieDelArbol = {
  especieId: string | null;
  especieCodigo: string | null;
  especieNombre: string | null;
  /** La RPC no lo devuelve: null en un conflicto. */
  especieNombreCientifico: string | null;
  subId: string;
};

export class ConflictoDeEspecieError extends ErrorDeEdicion {
  readonly vigente: EspecieDelArbol;
  constructor(vigente: EspecieDelArbol) {
    super(mensajeConflictoDeEspecie(vigente.especieNombre ?? NOMBRE_SIN_IDENTIFICAR));
    this.name = 'ConflictoDeEspecieError';
    this.vigente = vigente;
  }
}

type RespuestaCambio = {
  success?: boolean;
  error?: string;
  sub_id?: string;
  species_id?: string | null;
  codigo?: string | null;
  nombre?: string | null;
} | null;

function errorDeRespuesta(respuesta: RespuestaCambio): ErrorDeEdicion {
  if (respuesta?.error === ERROR_CAMBIO_DE_ESPECIE.conflicto) {
    return new ConflictoDeEspecieError({
      especieId: respuesta.species_id ?? null,
      especieCodigo: respuesta.codigo ?? null,
      especieNombre: respuesta.nombre ?? null,
      especieNombreCientifico: null,
      subId: respuesta.sub_id ?? '',
    });
  }
  return new ErrorDeEdicion(MENSAJE_RECHAZO[respuesta?.error ?? ''] ?? MENSAJE_RECHAZO_GENERICO);
}

/** Devuelve el SubID nuevo. Lanza `ConflictoDeEspecieError` si la base quedó vieja. */
export async function cambiarEspecieDeArbol(
  treeId: string,
  especieId: string,
  base: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc(RPC_CAMBIAR_ESPECIE_ARBOL, {
    p_tree_id: treeId,
    p_species_id: especieId,
    p_base: base,
  });
  if (error) throw errorDeSupabase(error);
  const respuesta = data as RespuestaCambio;
  if (!respuesta?.success || !respuesta.sub_id) throw errorDeRespuesta(respuesta);
  return respuesta.sub_id;
}
