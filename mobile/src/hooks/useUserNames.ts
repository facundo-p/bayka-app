import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';

const CACHE_KEY = 'user_names_cache';

/**
 * Returns initials from a full name (max 2 letters, uppercase).
 * Example: "Juan Perez" -> "JP", "Maria" -> "M"
 */
export function getInitials(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Returns the display name truncated to maxLength chars, or initials if longer.
 */
export function getDisplayName(nombre: string, maxLength: number = 15): string {
  if (nombre.length <= maxLength) return nombre;
  return getInitials(nombre);
}

type UserNamesMap = Record<string, string>;

/**
 * Resolves user UUIDs to display names.
 * Cache-first: reads AsyncStorage immediately, then fetches uncached IDs from Supabase.
 */
export function useUserNames(userIds: string[]): UserNamesMap {
  const [names, setNames] = useState<UserNamesMap>({});

  // Stringify for stable dependency comparison
  const userIdsKey = JSON.stringify(userIds);

  useEffect(() => {
    if (userIds.length === 0) return;

    let mounted = true;

    (async () => {
      // Step 1: Load from cache
      let cached: UserNamesMap = {};
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) cached = JSON.parse(raw);
      } catch {}

      // Populate state with whatever we have cached
      const fromCache: UserNamesMap = {};
      const uncachedIds: string[] = [];

      for (const id of userIds) {
        if (cached[id]) {
          fromCache[id] = cached[id];
        } else {
          uncachedIds.push(id);
        }
      }

      if (mounted && Object.keys(fromCache).length > 0) {
        setNames(fromCache);
      }

      // Step 2: Fetch uncached IDs from Supabase
      if (uncachedIds.length === 0) return;

      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, nombre')
          .in('id', uncachedIds);

        if (!data || !mounted) return;

        const fetched: UserNamesMap = {};
        for (const row of data) {
          if (row.id && row.nombre) {
            fetched[row.id] = row.nombre;
          }
        }

        const merged = { ...cached, ...fetched };

        // Persist updated cache
        try {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(merged));
        } catch {}

        if (mounted) {
          setNames((prev) => ({ ...prev, ...fetched }));
        }
      } catch {
        // Offline — cached data already set
      }
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdsKey]);

  return names;
}
