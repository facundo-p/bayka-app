import { sinAcentos } from './normalizarTexto';

/** Slug seguro para nombres de archivo: minúsculas, sin acentos ni símbolos. */
export function aSlug(texto: string): string {
  return sinAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
