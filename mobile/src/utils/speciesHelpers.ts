export function getSpeciesCode(tree: {
  especieId?: string | null;
  especieCodigo?: string | null;
}): string {
  if (!tree.especieId) return 'N/N';
  return tree.especieCodigo ?? '??';
}

export function getSpeciesName(tree: {
  especieId?: string | null;
  especieNombre?: string | null;
}): string {
  if (!tree.especieId) return 'N/N';
  return tree.especieNombre ?? '??';
}
