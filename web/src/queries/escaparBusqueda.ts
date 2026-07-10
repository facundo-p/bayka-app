/*
 * Escapado del texto de búsqueda para consultas PostgREST (supabase-js).
 *
 * supabase-js NO sanea nada: `.ilike(col, patrón)` produce `col=ilike.<patrón>`
 * y `.or(filtros)` produce `or=(<filtros>)`, ambos por interpolación cruda
 * (ver PostgrestFilterBuilder). Por eso el texto del usuario tiene que llegar
 * ya escapado, en DOS capas independientes:
 *
 * Capa SQL (semántica de LIKE/ILIKE)
 *   `%` y `_` son comodines de LIKE y `\` es el carácter de escape por defecto
 *   de PostgreSQL. Si el usuario escribe un `%`, `_` o `\` literal hay que
 *   escaparlo (`\%`, `\_`, `\\`) para que se compare como texto y no como
 *   patrón. Los `%` de borde que agregamos nosotros ("contiene") SÍ son
 *   comodines reales y quedan fuera del escapado.
 *
 * Capa gramática PostgREST (parseo del filtro en la URL)
 *   Dentro de `or=(...)` la coma separa condiciones y los paréntesis agrupan;
 *   una coma en el texto del usuario genera filtros fantasma y rompe la query.
 *   PostgREST resuelve esto permitiendo envolver el valor entre comillas
 *   dobles: dentro de las comillas la coma, los paréntesis, etc. son literales.
 *   Las comillas dobles y los backslashes internos se escapan con `\`
 *   (`\"` y `\\`). Las comillas son puramente de parseo: se descartan antes de
 *   pasar el valor al operador, así que los `%`/`_`/`\` de adentro conservan su
 *   semántica de LIKE (comodín o escape según la capa SQL de arriba).
 *
 * Referencias PostgREST:
 *   - Reserved characters / double quoting de valores con `,`/`.`/`:`/`()`.
 *   - LIKE: `%`/`_` comodines, `\` escape por defecto.
 *
 * Las dos capas se componen: primero se arma el patrón LIKE (capa SQL) y, solo
 * al incrustarlo en un `.or()`, se lo entrecomilla (capa gramática).
 */

/**
 * Escapa los comodines de LIKE (`%`, `_`) y el propio carácter de escape (`\`)
 * para que el texto del usuario se compare literalmente. El `\` va primero para
 * no re-escapar los backslashes que agregamos a `%`/`_`.
 */
export function escaparComodinesLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

/**
 * Patrón "contiene" listo para `.ilike()`: comodines de borde reales (`%…%`)
 * más el texto del usuario con sus comodines escapados.
 */
export function patronContiene(texto: string): string {
  return `%${escaparComodinesLike(texto)}%`;
}

/**
 * Entrecomilla un valor para incrustarlo con seguridad dentro de un filtro de
 * `.or()`: lo envuelve en comillas dobles y escapa `\` y `"` internos. El `\`
 * va primero para no duplicar los backslashes que agregamos al escapar `"`.
 */
export function citarValorOr(valor: string): string {
  const escapado = valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escapado}"`;
}

/**
 * Condición `columna.ilike.<patrón>` lista para `.or()`, con el texto del
 * usuario escapado en ambas capas (LIKE + gramática PostgREST).
 */
export function condicionIlikeOr(columna: string, texto: string): string {
  return `${columna}.ilike.${citarValorOr(patronContiene(texto))}`;
}
