/**
 * Formato del código de plantación (#559): copia de `contracts/codigo-plantacion.json`,
 * que es también el CHECK de Supabase. Un contract test las mantiene iguales.
 */
export const CODIGO_PLANTACION = {
  longitudMaxima: 8,
  patron: '^[A-Z0-9]+(-[A-Z0-9]+)*$',
  separadorIdArbol: '-',
} as const;
