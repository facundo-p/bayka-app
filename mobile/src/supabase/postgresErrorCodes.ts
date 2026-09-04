/**
 * Códigos SQLSTATE de Postgres que PostgREST/Supabase exponen en `error.code`.
 * Centralizados para no hardcodear literales opacos (`'23505'`) en la lógica de sync:
 * un literal suelto no se autodocumenta, es difícil de grepear y nadie nota si cambia.
 *
 * Estándar SQLSTATE (5 caracteres), contrato estable de PostgREST — no cambia entre
 * versiones del driver ni del locale. Ref: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *
 * Toda comparación contra `error.code` debe usar estas constantes, nunca el literal.
 * Código nuevo: agregalo acá con nombre y descripción.
 */
export const PG_ERROR = {
  /** unique_violation — choque con una constraint UNIQUE (p.ej. código de parcela duplicado). */
  UNIQUE_VIOLATION: '23505',
  /** foreign_key_violation — la FK apunta a una fila inexistente (p.ej. parcela cuya plantación aún no está en el server). */
  FOREIGN_KEY_VIOLATION: '23503',
  /** not_null_violation — falta un valor en una columna NOT NULL (p.ej. organizacion_id null). */
  NOT_NULL_VIOLATION: '23502',
  /** insufficient_privilege — RLS rechazó la operación (write como rol sin permiso / sesión anon). */
  INSUFFICIENT_PRIVILEGE: '42501',
  /** undefined_table — la tabla no existe (esquema desfasado). */
  UNDEFINED_TABLE: '42P01',
} as const;

export type PgErrorCode = (typeof PG_ERROR)[keyof typeof PG_ERROR];
