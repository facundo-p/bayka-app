import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Notify all active useLiveData hooks to refresh.
 * Call this after any DB write (insert, update, delete).
 */
export function notifyDataChanged() {
  listeners.forEach((fn) => fn());
}

/**
 * Reactive data hook — replaces drizzle's useLiveQuery which doesn't
 * reliably fire in Expo SDK 52.
 *
 * Re-fetches on:
 * 1. Mount
 * 2. Screen focus (navigation back)
 * 3. notifyDataChanged() calls
 */
export function useLiveData<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
): { data: T | undefined; refresh: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);

  const refresh = useCallback(() => {
    fetcher().then(setData).catch(console.error);
  }, deps);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  return { data, refresh };
}
