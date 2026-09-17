/**
 * Cliente de la edge function admin-plantaciones: borra la plantación vía RPC con
 * el JWT del usuario y después sus fotos de Storage con service_role (#478).
 */
import {
  ACCION,
  MENSAJES,
  type CuerpoRespuesta,
} from '../../../supabase/functions/admin-plantaciones/nucleo';
import { invocarEdgeFunction } from './edgeFunction';

const FUNCION = 'admin-plantaciones';

export const MENSAJE_ADMIN_PLANTACIONES_GENERICO = MENSAJES.errorGenerico;

export type ResultadoEliminacion = {
  /** Los datos se borraron pero quedaron fotos en Storage; un superadmin puede reintentar. */
  fotosPendientes: boolean;
};

/** `nombreConfirmacion` solo hace falta si la plantación tiene datos. */
export async function eliminarPlantacion(
  plantacionId: string,
  nombreConfirmacion?: string,
): Promise<ResultadoEliminacion> {
  const respuesta = await invocarEdgeFunction<CuerpoRespuesta>(
    FUNCION,
    { accion: ACCION.eliminar, plantacionId, nombreConfirmacion },
    MENSAJE_ADMIN_PLANTACIONES_GENERICO,
  );
  return { fotosPendientes: respuesta.fotosPendientes === true };
}
