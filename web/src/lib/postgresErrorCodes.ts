/**
 * Códigos SQLSTATE de Postgres que PostgREST/Supabase exponen en `error.code` (espejo de
 * mobile/src/supabase/postgresErrorCodes.ts); contrato estable, no cambia entre versiones ni locale.
 * Ref: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_ERROR = {
  /** unique_violation — choca una UNIQUE/PK (p.ej. asignar dos veces el mismo usuario a una plantación). */
  UNIQUE_VIOLATION: '23505',
  /** undefined_column — la columna no existe (p.ej. campos de la migración 024 sin aplicar). */
  UNDEFINED_COLUMN: '42703',
} as const;

export type PgErrorCode = (typeof PG_ERROR)[keyof typeof PG_ERROR];
