import {
  LONGITUD_MINIMA_PASSWORD,
  MENSAJES,
} from '../../../supabase/functions/admin-users/nucleo';

export const MENSAJE_NO_COINCIDEN = 'Las contraseñas no coinciden';

/** Valida una contraseña nueva con su confirmación (mismas reglas que el
 *  backend). Devuelve null si es válida; el motivo mostrable si no. */
export function validarNuevaPassword(password: string, confirmacion: string): string | null {
  if (password.length < LONGITUD_MINIMA_PASSWORD) return MENSAJES.passwordCorta;
  if (password !== confirmacion) return MENSAJE_NO_COINCIDEN;
  return null;
}
