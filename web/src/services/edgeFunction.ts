/** Invocación de edge functions con el contrato `{ ok, error? }`: el mensaje de error en español viene del backend. */
import { supabase } from '../lib/supabase';

export type RespuestaEdgeFunction = { ok: boolean; error?: string };

/** El SDK adjunta la Response del server en error.context: de ahí sale el mensaje cuando el status es de error. */
async function mensajeDelError(error: unknown): Promise<string | null> {
  const contexto = (error as { context?: Response } | null)?.context;
  if (!contexto || typeof contexto.json !== 'function') return null;
  try {
    const cuerpo = (await contexto.json()) as RespuestaEdgeFunction | null;
    return cuerpo?.error ?? null;
  } catch {
    return null;
  }
}

/** Devuelve el cuerpo si `ok`; si no, lanza con el mensaje del server o `mensajeGenerico` (red, respuesta no-JSON). */
export async function invocarEdgeFunction<T extends RespuestaEdgeFunction>(
  nombre: string,
  cuerpo: object,
  mensajeGenerico: string,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nombre, { body: cuerpo });
  if (!error && data?.ok) return data;
  const mensaje = data?.error ?? (await mensajeDelError(error));
  throw new Error(mensaje ?? mensajeGenerico);
}
