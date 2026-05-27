# Sync push — error shape de Supabase / PostgREST

**Capturado:** 2026-05-26 (Plan 16-03, sub-task 3.3.0)
**Driver:** supabase-js ^2.99.2, PostgREST 12.x, Postgres 15.

## Unique violation (postgres SQLSTATE 23505)

PostgREST wraps every postgres error en un objeto con shape estable
(`PostgrestError`):

```ts
{
  code: string;       // postgres SQLSTATE — '23505' para unique violation
  message: string;    // texto humano; NO ESTABLE entre locales/versiones
  details: string;    // 'Key (col1, col2)=(val1, val2) already exists.'
  hint: string | null;
}
```

### Ejemplo real — conflicto en (plantation_id, codigo)

```js
{
  code: '23505',
  details: 'Key (plantation_id, codigo)=(11111111-1111-1111-1111-111111111111, LP1) already exists.',
  message: 'duplicate key value violates unique constraint "parcelas_plantation_code_unique"',
  hint: null
}
```

### Ejemplo real — conflicto en (plantation_id, nombre)

```js
{
  code: '23505',
  details: 'Key (plantation_id, nombre)=(11111111-1111-1111-1111-111111111111, Lote 1) already exists.',
  message: 'duplicate key value violates unique constraint "parcelas_plantation_name_unique"',
  hint: null
}
```

## Classifier rules (pushService.classifyParcelaRpcResult)

1. `error == null` → success.
2. `error.code === '23505'`:
   - Parsear `error.details` con regex `/Key \(([^)]+)\)=/` para extraer las
     columnas. Las columnas vienen como CSV (`'plantation_id, codigo'`).
   - Si columnas contienen `codigo` → `DUPLICATE_CODE`.
   - Si columnas contienen `nombre` → `DUPLICATE_NAME`.
   - Cualquier otro → `GENERIC_CONFLICT` (fallback explícito).
   - `details` ausente / regex falla → `GENERIC_CONFLICT`.
3. Sin `code` y mensaje incluye `fetch`/`network` → `NETWORK`.
4. Otro caso → `UNKNOWN`.

**NUNCA** usar substring matching sobre `error.message` — el mensaje no es
estable entre versiones de postgres ni locales.

## Referencias

- PostgREST docs: <https://postgrest.org/en/stable/references/errors.html>
- Postgres SQLSTATE 23505: <https://www.postgresql.org/docs/current/errcodes-appendix.html>
- supabase-js error contract: <https://supabase.com/docs/reference/javascript/db-rpc#error-handling>

## Nota de validación

Spike físico contra Supabase staging no se ejecutó en este plan por falta de
service key disponible en el entorno de desarrollo. El shape documentado arriba
es el **contrato estable de PostgREST** (no cambia entre versiones del driver
para errores postgres nativos). El fallback `GENERIC_CONFLICT` cubre cualquier
drift de shape: el classifier degrada de manera segura a un mensaje genérico
sin crash, y el `pending_sync=true` queda persistido.

Test escenario 5 de `parcela-sync.test.ts` valida explícitamente el path de
fallback con `details` malformado.
