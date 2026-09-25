/**
 * Reemplazo de especies y técnicos de una plantación en un solo RPC transaccional
 * (#544). Borrar e insertar en dos requests dejaba la plantación vacía si el
 * segundo fallaba.
 */
import { supabase } from '../supabase/client';
import { esFuncionInexistente } from '../supabase/postgresErrorCodes';
import { MOTIVO_NO_ESCRIBIBLE, PlantacionNoEscribibleError, type MotivoNoEscribible } from './PlantacionEscribibleService';

export const RPC_REEMPLAZAR_ESPECIES = 'reemplazar_especies_plantacion';
export const RPC_REEMPLAZAR_TECNICOS = 'reemplazar_tecnicos_plantacion';

/** Rechazos de los RPC que no son un motivo de `motivo_no_escribible`. */
export const RECHAZO_CONFIGURACION = {
  sinPermiso: 'NOT_AUTHORIZED',
  especieInexistente: 'ESPECIE_INEXISTENTE',
  especieConArboles: 'ESPECIE_CON_ARBOLES',
  usuarioDeOtraOrganizacion: 'USUARIO_DE_OTRA_ORGANIZACION',
} as const;

type RechazoConfiguracion = (typeof RECHAZO_CONFIGURACION)[keyof typeof RECHAZO_CONFIGURACION];

const NO_SE_GUARDARON = 'Los cambios no se guardaron.';

const MENSAJE_POR_RECHAZO: Record<RechazoConfiguracion, string> = {
  [RECHAZO_CONFIGURACION.sinPermiso]: `No tenés permiso para cambiar esta plantación. ${NO_SE_GUARDARON}`,
  [RECHAZO_CONFIGURACION.especieInexistente]:
    `Alguna de las especies elegidas ya no existe en el servidor. ${NO_SE_GUARDARON}`,
  [RECHAZO_CONFIGURACION.especieConArboles]:
    `Alguna de las especies que quitaste ya tiene árboles registrados en el servidor. ${NO_SE_GUARDARON}`,
  [RECHAZO_CONFIGURACION.usuarioDeOtraOrganizacion]:
    `Alguno de los técnicos elegidos no pertenece a tu organización. ${NO_SE_GUARDARON}`,
};

export class ReemplazoRechazadoError extends Error {
  constructor(readonly rechazo: string) {
    super(MENSAJE_POR_RECHAZO[rechazo as RechazoConfiguracion] ?? `El servidor rechazó el cambio. ${NO_SE_GUARDARON}`);
    this.name = 'ReemplazoRechazadoError';
  }
}

type RespuestaReemplazo = { success: boolean; error?: string } | null;

function esMotivoNoEscribible(codigo: string): codigo is MotivoNoEscribible {
  return Object.values(MOTIVO_NO_ESCRIBIBLE).some((motivo) => motivo === codigo);
}

function errorDeRechazo(codigo: string): Error {
  return esMotivoNoEscribible(codigo) ? new PlantacionNoEscribibleError(codigo) : new ReemplazoRechazadoError(codigo);
}

interface Reemplazo {
  rpc: string;
  args: Record<string, unknown>;
  /** Camino anterior, solo para un server sin el RPC. */
  sinRpc: () => Promise<void>;
}

/** Un error de red o del server se propaga tal cual: nada quedó a medias. */
export async function reemplazarConfiguracion({ rpc, args, sinRpc }: Reemplazo): Promise<void> {
  const { data, error } = await supabase.rpc(rpc, args);
  if (error) {
    if (esFuncionInexistente(error)) return sinRpc();
    throw error;
  }
  const respuesta = data as RespuestaReemplazo;
  if (!respuesta?.success) throw errorDeRechazo(respuesta?.error ?? '');
}
