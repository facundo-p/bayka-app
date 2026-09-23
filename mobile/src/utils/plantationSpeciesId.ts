/** Id local de plantation_species, derivado del par: el pull upsertea por id, así que otro formato duplicaría la fila. */
export function plantationSpeciesId(plantacionId: string, especieId: string): string {
  return `ps-${plantacionId}-${especieId}`;
}
