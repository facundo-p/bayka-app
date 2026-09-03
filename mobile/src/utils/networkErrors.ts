/**
 * Message substring React Native's fetch (used by the Supabase client)
 * throws when there is no network connectivity at request time. Runtime
 * contract, not configurable — centralized so callers never compare
 * `e.message` against the raw literal.
 */
const NETWORK_REQUEST_FAILED_MESSAGE = 'Network request failed';

/** True when `e` is a fetch failure due to no network connectivity. */
export function isNetworkRequestFailed(e: unknown): boolean {
  const message = (e as { message?: unknown })?.message;
  return typeof message === 'string' && message.includes(NETWORK_REQUEST_FAILED_MESSAGE);
}
