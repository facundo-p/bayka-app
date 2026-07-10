# Edge Functions

## admin-users

Operaciones privilegiadas del ABM de usuarios (épica #224). Requiere
service_role, por eso vive acá y no en el cliente web.

| Acción | Payload | Efecto |
|--------|---------|--------|
| `crear` | `{accion, nombre, email, rol}` | `inviteUserByEmail` con metadata → el trigger `handle_new_user` crea el profile; Supabase envía el mail de invitación |
| `reenviarInvitacion` | `{accion, email}` | Envía el mail de recuperación de contraseña (sirve como reenvío de invitación y como "olvidé mi contraseña") |
| `desactivar` | `{accion, userId}` | Ban en Auth (10 años, reversible) + `profiles.activo = false` |
| `reactivar` | `{accion, userId}` | Quita el ban + `profiles.activo = true` |
| `cambiarPassword` | `{accion, userId, password}` | `updateUserById({password})`. Bloqueado sobre OTRO superadmin |
| `cambiarEmail` | `{accion, userId, email}` | `updateUserById({email})`; el trigger sincroniza `profiles.email` |

Solo un **superadmin activo** puede invocarla (JWT del caller validado
server-side). Guards: sin auto-desactivación, sin desactivar al último
superadmin activo, sin cambiar la contraseña de otro superadmin.

### Estructura

- `nucleo.ts` — lógica y reglas de negocio con dependencias inyectadas.
  **Sin imports**: se testea con la suite vitest de la web
  (`cd web && npm test`), fuera del runtime de Deno.
- `index.ts` — entry de Deno: CORS, HTTP y adaptadores de supabase-js.
  No se testea localmente (no hay Deno en el entorno de desarrollo).

### Deploy

```bash
supabase functions deploy admin-users
supabase secrets set WEB_URL=https://<dominio-de-la-web>
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma.
`WEB_URL` es la base de los links de invitación/recuperación
(`<WEB_URL>/establecer-password`); debe estar en la allowlist de Redirect
URLs de Auth (dashboard → Authentication → URL Configuration).

### Requisito previo

La migración `026_abm_usuarios.sql` aplicada (columnas `email`/`activo` y
triggers).

### Rate limit de emails

El SMTP default de Supabase permite ~2 emails/hora: suficiente para probar,
insuficiente para operar. Para uso real configurar SMTP propio
(dashboard → Authentication → SMTP Settings).
