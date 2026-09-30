# Configuración manual de Supabase por entorno

Lo que **no** viaja en migraciones ni en dumps: se configura a mano en el
dashboard de cada proyecto y hay que replicarlo en los dos. Esta es la lista
para un cutover, un proyecto nuevo o un restore (#249).

| Entorno | Proyecto | Web |
|---|---|---|
| staging | `uchejlyyabtrjoxyydmb` (Plantaciones Staging) | `https://staging.bayka-app.pages.dev` |
| prod | `mgtaeogxzuavxrfhrefi` (Plantaciones Prod) | `https://bayka-app.pages.dev` |

Las credenciales de los dos proyectos viven en el Bitwarden del cliente.

## Auth

### Registro público: SIEMPRE apagado

**Authentication → Sign In / Providers → Email → "Allow new users to sign up" → off.**

Hasta #607 el registro abierto metía a cualquiera con una casilla de mail en
la organización del cliente: `handle_new_user` le asignaba la organización del
MVP y la policy `Members can read org profiles` le mostraba el directorio de
usuarios (#606). Desde la migración 060 el profile nace sin organización y no
lee nada, así que el toggle ya no es la única barrera; igual se deja apagado:
un registro abierto crea cuentas basura en Auth.

**No rompe ningún flujo:** la app no llama a `signUp` en ningún lado. Las altas
entran por `inviteUserByEmail` desde `admin-users`, que usa la service_role —
el Admin API ignora este toggle y las invitaciones siguen funcionando.

Verificación sin credenciales de admin y sin crear usuarios (la anon key va
horneada en el bundle que la web sirve a cualquiera):

```bash
curl -s "https://<ref>.supabase.co/auth/v1/settings" -H "apikey: <anon-key>" \
  | grep -o '"disable_signup":[a-z]*'                    # → true

curl -s -X POST "https://<ref>.supabase.co/auth/v1/signup" \
  -H "apikey: <anon-key>" -H 'content-type: application/json' \
  -d '{"email":"probe@example.com","password":"x"}'      # → "Signups not allowed for this instance"
```

El segundo importa: con el registro abierto GoTrue llega a validar la
contraseña y responde `weak_password`, lo que prueba que aceptó el registro.
Con el registro cerrado corta antes de mirar los datos.

### Resto de Auth

- **Proveedores:** solo Email. Sin OAuth.
- **Confirmación de email:** `mailer_autoconfirm = false` en los dos.
- **URL Configuration (Site URL y Redirect URLs):** por entorno, detalle y
  verificación en [`supabase/functions/README.md`](../supabase/functions/README.md).
- **SMTP:** el default de Supabase admite ~2 emails/hora — alcanza para probar,
  no para operar. Para uso real, Authentication → SMTP Settings.
- **Políticas de contraseña, email templates y rate limits de Auth:** no
  relevados; solo se ven en el dashboard.

## Edge functions

`supabase secrets set WEB_URL=…` + `supabase functions deploy` de `admin-users`
y `admin-plantaciones`, en cada proyecto. El orden importa y cambiar `WEB_URL`
exige redeploy: checklist completa en
[`supabase/functions/README.md`](../supabase/functions/README.md).

## Database webhooks y cron jobs

Las migraciones no usan `pg_cron`, `pg_net` ni `supabase_functions.hooks`, y
los dos proyectos se recrearon desde `supabase/migrations/`. Si hace falta uno,
va en una migración, no en el dashboard.

## Verificación sin credenciales

- Site URL y allowlist: el `curl` a `/auth/v1/verify` y la tabla de estado
  esperado en [`supabase/functions/README.md`](../supabase/functions/README.md).
- Edge functions: un `POST` sin token a `/functions/v1/admin-users` y
  `/functions/v1/admin-plantaciones` responde `401`.
