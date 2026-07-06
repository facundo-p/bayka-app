/** Normaliza el resultado de un count head de Supabase: lanza si hubo error. */
export function contarOLanzar(
  count: number | null,
  error: { message: string } | null,
): number {
  if (error) throw new Error(error.message);
  return count ?? 0;
}
