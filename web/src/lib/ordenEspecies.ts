/** Orden de las especies de una plantación: alfabético por nombre, en web y mobile (#635). */
export function porNombre<T extends { nombre: string }>(especies: readonly T[]): T[] {
  return [...especies].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
