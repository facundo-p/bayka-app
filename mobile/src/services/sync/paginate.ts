import { abortarSiCancelado, estaCancelado, signalDeCancelacion, SyncCanceladoError } from './cancelacion';
import { errorDeTimeout, esTimeout } from '../../supabase/fetchConTimeout';

/**
 * Pagina una query de Supabase con .range() para saltar el límite default de 1000 filas de
 * PostgREST; `buildQuery` debe devolver un builder fresco por llamada. Fallback: si no expone
 * .range() (mocks de test), se usa como página única.
 */
export async function fetchAllRows<T>(
  buildQuery: () => any,
  onPagina?: (filasDescargadas: number) => void,
): Promise<{ data: T[] | null; error: any }> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  // Safety cap: 1M rows. If exceeded, something is wrong upstream.
  while (from < 1_000_000) {
    abortarSiCancelado();
    // El signal mata la página EN VUELO; sin él la cancelación recién se nota al
    // volver de la request, que con mala señal son los 30s del timeout (#451).
    const query = conSignalDeCancelacion(buildQuery());
    const pageResult = typeof query?.range === 'function'
      ? await query.range(from, from + PAGE_SIZE - 1)
      : await query;
    const { data, error } = pageResult;
    // postgrest devuelve el abort como `{ error }`, no como throw: sin esto una
    // cancelación se reporta al usuario como un error del servidor.
    if (error && estaCancelado()) throw new SyncCanceladoError();
    // Un timeout no es "esta tabla vino vacía". Devolverlo como `{ error }` hace
    // que la fase lo loguee y siga, y el pull termina incompleto reportado como
    // exitoso: el throw corta el sync con el mensaje correcto (#451).
    if (esTimeout(error)) throw errorDeTimeout(error);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    // La paginación es la parte lenta con mala señal y no emitía nada: sin esto la
    // pantalla queda quieta durante N/1000 round-trips.
    onPagina?.(all.length);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { data: all, error: null };
}

/** `.abortSignal()` existe en el builder de postgrest; los mocks de test no lo tienen. */
function conSignalDeCancelacion(query: any): any {
  const signal = signalDeCancelacion();
  if (!signal || typeof query?.abortSignal !== 'function') return query;
  return query.abortSignal(signal);
}
