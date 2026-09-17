/*
 * Escapado del texto de búsqueda para PostgREST vía supabase-js: `.ilike()`/`.or()` interpolan el
 * patrón crudo en la URL sin sanear. Se necesitan DOS capas de escape independientes:
 *
 * 1) SQL (semántica LIKE): `%`/`_` son comodines y `\` es el escape default de Postgres; un
 *    `%`/`_`/`\` literal del usuario se escapa (`\%`, `\_`, `\\`) para comparar como texto. Los
 *    `%` de borde que agregamos nosotros ("contiene") quedan como comodines reales.
 * 2) Gramática PostgREST (parseo de la URL): dentro de `or=(...)` coma y paréntesis tienen
 *    significado estructural; una coma del usuario rompe la query. Se resuelve entrecomillando
 *    (ahí son literales) y escapando `"`/`\` internos; las comillas se descartan antes de pasar
 *    el valor al operador, así que el escape SQL de adentro sobrevive intacto.
 *
 * Las capas se componen: primero el patrón LIKE, después se entrecomilla al incrustarlo en `.or()`.
 */

/** Escapa comodines de LIKE (`%`,`_`) y `\`; `\` va primero para no re-escapar los backslashes agregados a `%`/`_`. */
export function escaparComodinesLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

/** Patrón "contiene" para `.ilike()`: `%…%` reales alrededor del texto con sus comodines escapados. */
export function patronContiene(texto: string): string {
  return `%${escaparComodinesLike(texto)}%`;
}

/** Entrecomilla para `.or()`, escapando `\` y `"` internos; `\` va primero para no duplicar backslashes agregados al escapar `"`. */
export function citarValorOr(valor: string): string {
  const escapado = valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escapado}"`;
}

/** Condición `columna.ilike.<patrón>` para `.or()`, con el texto escapado en ambas capas. */
export function condicionIlikeOr(columna: string, texto: string): string {
  return `${columna}.ilike.${citarValorOr(patronContiene(texto))}`;
}
