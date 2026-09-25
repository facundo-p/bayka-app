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
  /** undefined_function — la función no existe (server sin la migración del RPC). */
  UNDEFINED_FUNCTION: '42883',
} as const;

export type PgErrorCode = (typeof PG_ERROR)[keyof typeof PG_ERROR];

/**
 * Códigos propios de PostgREST (no son SQLSTATE) que también llegan en `error.code`.
 * Ref: https://docs.postgrest.org/en/stable/references/errors.html
 */
export const POSTGREST_ERROR = {
  /** PostgREST no encuentra la función en su schema cache (RPC inexistente o firma distinta). */
  FUNCTION_NOT_FOUND: 'PGRST202',
  /** `.single()` sin filas: el servidor respondió que no hay fila (o RLS no deja verla). */
  SIN_FILAS: 'PGRST116',
} as const;

/** `.single()` no encontró fila: es una respuesta del servidor, no un fallo de red. */
export function esSinFilas(error: { code?: string } | null | undefined): boolean {
  return error?.code === POSTGREST_ERROR.SIN_FILAS;
}

/** El RPC no existe en el server: hay que caer al camino anterior. */
export function esFuncionInexistente(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === PG_ERROR.UNDEFINED_FUNCTION || error?.code === POSTGREST_ERROR.FUNCTION_NOT_FOUND;
}
