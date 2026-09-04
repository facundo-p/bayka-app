/** Message substring RN's fetch (via the Supabase client) throws with no network connectivity. Runtime contract, not configurable — callers never compare `e.message` against the raw literal directly. */
const NETWORK_REQUEST_FAILED_MESSAGE = 'Network request failed';

/** True when `e` is a fetch failure due to no network connectivity. */
export function isNetworkRequestFailed(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(NETWORK_REQUEST_FAILED_MESSAGE);
}
