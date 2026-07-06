import { QueryClient } from '@tanstack/react-query';

/** Los listados cambian poco: 30s sin refetch evita pegarle a Supabase de más. */
const STALE_TIME_MS = 30_000;

/** Cliente único de TanStack Query para toda la web. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: STALE_TIME_MS, retry: 1 },
  },
});
