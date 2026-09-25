/**
 * Edición de los campos de una plantación por la RPC `editar_plantacion` (#634):
 * cada cambio viaja con el valor que tenía el formulario al abrirse (la base), y
 * el server no lo aplica si alguien lo cambió desde otro lado mientras tanto.
 */
import { errorDeSupabase, mensajeDeError } from '../lib/clasificarError';
import { supabase } from '../lib/supabase';

const RPC_EDITAR_PLANTACION = 'editar_plantacion';

/** Valores por columna de `plantations`. */
export type ValoresDePlantacion = Record<string, string | number | boolean | null>;

export const ERROR_EDICION = {
  conflicto: 'CONFLICTO_EDICION',
  noAutorizado: 'NOT_AUTHORIZED',
  inexistente: 'PLANTACION_INEXISTENTE',
  finalizada: 'PLANTACION_FINALIZADA',
  archivada: 'PLANTACION_ARCHIVADA',
  datosInvalidos: 'DATOS_INVALIDOS',
} as const;

export const MENSAJE_CONFLICTO_EDICION =
  'Alguien cambió estos datos desde otro lado mientras editabas. Guardamos lo demás y ' +
  'cargamos lo que hay ahora: revisalo y volvé a guardar si hace falta.';

const MENSAJE_RECHAZO: Record<string, string> = {
  [ERROR_EDICION.noAutorizado]: 'Tu usuario no tiene permisos para editar esta plantación.',
  [ERROR_EDICION.inexistente]: 'La plantación ya no existe.',
  [ERROR_EDICION.finalizada]: 'La plantación está finalizada: no se puede editar.',
  [ERROR_EDICION.archivada]: 'La plantación está archivada: desarchivala para editarla.',
  [ERROR_EDICION.datosInvalidos]: 'El servidor rechazó un dato inválido. Revisá el formulario.',
};

const MENSAJE_RECHAZO_GENERICO = 'No se pudo guardar el cambio. Probá de nuevo.';

export type ConflictoDeCampo = {
  /** Columna de `plantations`. */
  campo: string;
  valorServidor: unknown;
};

/** Mensaje para el usuario que escribió el repositorio: se muestra tal cual. */
export class ErrorDeEdicion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeEdicion';
  }
}

/** Los campos de `conflictos` no se guardaron; el resto sí. */
export class ConflictoDeEdicionError extends ErrorDeEdicion {
  readonly conflictos: ConflictoDeCampo[];
  constructor(conflictos: ConflictoDeCampo[]) {
    super(MENSAJE_CONFLICTO_EDICION);
    this.name = 'ConflictoDeEdicionError';
    this.conflictos = conflictos;
  }
}

type ConflictoRemoto = { campo: string; valor_servidor: unknown };
type RespuestaEdicion = {
  success?: boolean;
  error?: string;
  conflictos?: ConflictoRemoto[];
} | null;

/** El valor del server para `campo` si chocó, o `undefined`. */
export function valorDelServidor(error: unknown, campo: string): unknown {
  if (!(error instanceof ConflictoDeEdicionError)) return undefined;
  return error.conflictos.find((conflicto) => conflicto.campo === campo)?.valorServidor;
}

/** Mensaje de un error de edición: el del repositorio si lo escribió él, si no el clasificado. */
export function mensajeDeErrorDeEdicion(error: Error | null, accion: string): string | null {
  if (!error) return null;
  return error instanceof ErrorDeEdicion ? error.message : mensajeDeError(error, accion);
}

function soloLosQueCambiaron(cambios: ValoresDePlantacion, base: ValoresDePlantacion) {
  const cambiados = Object.keys(cambios).filter((campo) => cambios[campo] !== base[campo]);
  return {
    cambios: Object.fromEntries(cambiados.map((campo) => [campo, cambios[campo]])),
    base: Object.fromEntries(cambiados.map((campo) => [campo, base[campo]])),
  };
}

function errorDeRespuesta(respuesta: RespuestaEdicion): ErrorDeEdicion {
  if (respuesta?.error === ERROR_EDICION.conflicto) {
    const conflictos = (respuesta.conflictos ?? []).map((conflicto) => ({
      campo: conflicto.campo,
      valorServidor: conflicto.valor_servidor,
    }));
    return new ConflictoDeEdicionError(conflictos);
  }
  return new ErrorDeEdicion(MENSAJE_RECHAZO[respuesta?.error ?? ''] ?? MENSAJE_RECHAZO_GENERICO);
}

/** Sube solo los campos que difieren de la base. Lanza `ConflictoDeEdicionError` si alguno chocó. */
export async function editarCamposDePlantacion(
  id: string,
  cambios: ValoresDePlantacion,
  base: ValoresDePlantacion,
): Promise<void> {
  const diferencia = soloLosQueCambiaron(cambios, base);
  if (Object.keys(diferencia.cambios).length === 0) return;
  const { data, error } = await supabase.rpc(RPC_EDITAR_PLANTACION, {
    p_id: id,
    p_cambios: diferencia.cambios,
    p_base: diferencia.base,
  });
  if (error) throw errorDeSupabase(error);
  const respuesta = data as RespuestaEdicion;
  if (!respuesta?.success) throw errorDeRespuesta(respuesta);
}
