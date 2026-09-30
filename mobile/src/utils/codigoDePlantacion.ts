/** Código de plantación (#559): normalización, validación e ID de árbol, con las reglas de la web. */
import { CODIGO_PLANTACION } from '../constants/codigoPlantacion';

const PATRON = new RegExp(CODIGO_PLANTACION.patron);

export const MENSAJE_CODIGO_PLANTACION = {
  obligatorio: 'El código es obligatorio.',
  largo: `El código tiene hasta ${CODIGO_PLANTACION.longitudMaxima} caracteres.`,
  formato: 'El código lleva solo letras, números y guiones sueltos, sin guion al principio ni al final.',
  duplicado: 'Ya existe otra plantación con ese código.',
} as const;

/** Mientras se tipea: mayúsculas y sin espacios. */
export function normalizarCodigoPlantacion(texto: string): string {
  return texto.toUpperCase().replace(/\s+/g, '');
}

export function errorCodigoPlantacion(codigo: string): string | null {
  if (codigo === '') return MENSAJE_CODIGO_PLANTACION.obligatorio;
  if (codigo.length > CODIGO_PLANTACION.longitudMaxima) return MENSAJE_CODIGO_PLANTACION.largo;
  return PATRON.test(codigo) ? null : MENSAJE_CODIGO_PLANTACION.formato;
}

/**
 * ID del árbol en toda la organización: `<SubID>-<código de plantación>`. Una plantación
 * que todavía no bajó su código (anterior a la versión que lo trae) muestra solo el SubID.
 */
export function idDeArbol(subId: string, codigoPlantacion: string | null | undefined): string {
  return codigoPlantacion ? `${subId}${CODIGO_PLANTACION.separadorIdArbol}${codigoPlantacion}` : subId;
}
