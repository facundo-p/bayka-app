import { mensajeDeError } from './clasificarError';

/** Un error cuyo mensaje escribió el repositorio para el usuario se muestra tal
 *  cual; cualquier otro se clasifica (red / permiso / servidor) para `accion`. */
export function mensajeErrorConocido(
  error: Error | null,
  conocido: string,
  accion: string,
): string | null {
  if (!error) return null;
  return error.message === conocido ? error.message : mensajeDeError(error, accion);
}
