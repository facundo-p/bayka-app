/*
 * Wrapper de `supabase.auth` para flujos que no pasan por `useAuth` (el hook
 * resuelve acceso a la web vía perfil/rol, y por diseño un técnico invitado
 * queda "sin-acceso" ahí — pero igual necesita definir su contraseña). Acá
 * viven las llamadas crudas al SDK para que las pantallas no importen
 * `supabase` directamente.
 */
import type { AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/** Sesión actual, si la hay (undefined mientras el SDK no resolvió aún no aplica: siempre resuelve). */
export async function obtenerSesionActual(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Se suscribe a cambios de sesión (login/logout, o la sesión que el link de
 *  invitación/recuperación procesa en segundo plano). Devuelve la función de
 *  desuscripción. */
export function suscribirseACambiosDeSesion(
  callback: (sesion: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => callback(sesion));
  return () => data.subscription.unsubscribe();
}

/** Actualiza la contraseña del usuario autenticado (sesión del link de invitación/recuperación). */
export async function actualizarPasswordUsuario(
  password: string,
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error };
}
