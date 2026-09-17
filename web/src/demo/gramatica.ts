/** Lo poco de la gramática de PostgREST que el cliente demo necesita leer: listas
 *  separadas por comas (select, or) y valores entre comillas. */

const PROFUNDIDAD: Readonly<Record<string, number | undefined>> = { '(': 1, ')': -1 };
const SEPARADOR = ',';
const COMILLA = '"';
const BARRA = '\\';
const ENTRE_COMILLAS = /^"(.*)"$/s;
const CARACTER_ESCAPADO = /\\(.)/gs;

/** Parte en las comas de primer nivel: no cortan las de adentro de un paréntesis
 *  ni las de un valor entre comillas. */
export function partirNivelSuperior(texto: string): string[] {
  const partes = [''];
  let profundidad = 0;
  let entreComillas = false;
  let escapado = false;
  for (const caracter of texto) {
    if (caracter === SEPARADOR && profundidad === 0 && !entreComillas) partes.push('');
    else partes[partes.length - 1] += caracter;
    if (escapado) escapado = false;
    else if (caracter === BARRA) escapado = entreComillas;
    else if (caracter === COMILLA) entreComillas = !entreComillas;
    else if (!entreComillas) profundidad += PROFUNDIDAD[caracter] ?? 0;
  }
  return partes.map((parte) => parte.trim());
}

/** Quita las comillas y el escape de `\` y `"` que agrega `citarValorOr`; el
 *  escape de LIKE de adentro (`\%`) queda intacto. */
export function desentrecomillar(valor: string): string {
  const interior = ENTRE_COMILLAS.exec(valor)?.[1];
  return interior === undefined ? valor : interior.replace(CARACTER_ESCAPADO, '$1');
}
