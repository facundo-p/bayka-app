import { useSegments } from 'expo-router';

/**
 * Returns the current route group segment, e.g. '(tecnico)' or '(admin)'.
 * Used by shared screens to build navigation paths that work under either group.
 */
export function useRoutePrefix(): string {
  const segments = useSegments();
  // First segment is the route group including parens: '(tecnico)' or '(admin)'
  return segments[0] ?? '(tecnico)';
}
