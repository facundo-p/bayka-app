/**
 * Orden de las especies: alfabético por nombre, igual en web, mobile y en el
 * `orden_visual` del server (#635). Sin distinguir acentos ni mayúsculas.
 */
export function porNombre<T extends { nombre: string }>(especies: readonly T[]): T[] {
  return [...especies].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  );
}
