/**
 * Código de plantación y ID de árbol (#559). Contrato con contracts/codigo-plantacion.json,
 * que es también el CHECK de la base: cambian juntos.
 */
export const CODIGO_PLANTACION = {
  longitudMaxima: 8,
  patron: '^[A-Z0-9]+(-[A-Z0-9]+)*$',
  separadorIdArbol: '-',
} as const;

const PATRON_CODIGO = new RegExp(CODIGO_PLANTACION.patron);
const ESPACIOS = /\s+/g;

export const MENSAJE_CODIGO_PLANTACION = {
  obligatorio: 'El código es obligatorio',
  largo: `El código tiene hasta ${CODIGO_PLANTACION.longitudMaxima} caracteres`,
  formato: 'Solo letras, números y guiones sueltos, sin guion al principio ni al final',
  duplicado: 'Ya existe otra plantación con ese código.',
} as const;

/** Lo que se tipea, en mayúsculas y sin espacios. */
export function normalizarCodigoPlantacion(texto: string): string {
  return texto.toUpperCase().replace(ESPACIOS, '');
}

/** El error del código ya normalizado, o `undefined` si es válido. */
export function errorCodigoPlantacion(codigo: string): string | undefined {
  if (codigo === '') return MENSAJE_CODIGO_PLANTACION.obligatorio;
  if (codigo.length > CODIGO_PLANTACION.longitudMaxima) return MENSAJE_CODIGO_PLANTACION.largo;
  if (!PATRON_CODIGO.test(codigo)) return MENSAJE_CODIGO_PLANTACION.formato;
}

/** ID del árbol en toda la organización: `<SubID>-<código de plantación>`; sin código, el SubID solo. */
export function idDeArbol(subId: string, codigoPlantacion: string | null | undefined): string {
  return codigoPlantacion
    ? `${subId}${CODIGO_PLANTACION.separadorIdArbol}${codigoPlantacion}`
    : subId;
}
