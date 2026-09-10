/** Minúsculas y sin acentos: "Lucía" y "lucia" comparan igual. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
