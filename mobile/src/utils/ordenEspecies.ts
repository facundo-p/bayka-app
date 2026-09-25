/**
 * Orden de las especies: alfabético por nombre, igual en web, mobile y en el
 * `orden_visual` del server (#635). Sin distinguir acentos ni mayúsculas.
 */
export function compararPorNombre(a: { nombre: string }, b: { nombre: string }): number {
  return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
}

export function porNombre<T extends { nombre: string }>(especies: readonly T[]): T[] {
  return [...especies].sort(compararPorNombre);
}
