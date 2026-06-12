/**
 * Códigos de error SQLSTATE de Postgres que PostgREST/Supabase exponen en
 * `error.code`. Centralizados acá para NO hardcodear strings opacos en la
 * lógica de datos — un literal suelto no se autodocumenta, es difícil de
 * grepear y nadie nota si cambia el contrato. Espejo del módulo homónimo
 * de mobile (mobile/src/supabase/postgresErrorCodes.ts): solo los códigos
 * que la web usa.
 *
 * Son códigos del estándar SQLSTATE de Postgres (5 caracteres), contrato
 * estable de PostgREST: no cambian entre versiones del driver ni del locale.
 * Ref: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *
 * REGLA (enforzada por eslint `no-restricted-syntax`): cualquier comparación
 * contra `error.code` debe usar estas constantes, nunca el literal.
 */
export const PG_ERROR = {
  /** undefined_column — la columna no existe (p.ej. campos de la migración 024 sin aplicar). */
  UNDEFINED_COLUMN: '42703',
} as const;

export type PgErrorCode = (typeof PG_ERROR)[keyof typeof PG_ERROR];
