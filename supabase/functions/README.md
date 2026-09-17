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
| `previsualizarEliminacion` | `{accion, userId}` | Devuelve `preview: {arboles, grupos, plantaciones, modo}`: cuenta `trees.usuario_registro`, `groups.usuario_creador` y `plantations.creado_por`; `modo` es `real` sin registros y `logico` con alguno |
| `eliminar` | `{accion, userId}` | Irreversible. Recuenta los registros (no confía en el preview). **Real:** borra sus `plantation_users` + `auth.admin.deleteUser` (el profile cae por cascade). **Lógico:** ban de ~100 años → `activo = false` → borra sus `plantation_users` → email a `eliminado+<id>@bayka.invalid` (con `email_confirm`, sin mail) → `profiles.eliminado_en = now()` |
| `cambiarPassword` | `{accion, userId, password}` | `updateUserById({password})`. Bloqueado sobre OTRO superadmin |
| `cambiarEmail` | `{accion, userId, email}` | `updateUserById({email})`; el trigger sincroniza `profiles.email` |

Solo un **superadmin activo** puede invocarla (JWT del caller validado
server-side). Guards:
- Nadie se desactiva ni se elimina a sí mismo.
- No se desactiva ni se elimina al último superadmin activo.
- No se cambia la contraseña ni el email de otro superadmin.
- Un usuario con `eliminado_en` rechaza todas las acciones.
- Ningún email del dominio `bayka.invalid` es válido: `reenviarInvitacion`
  sobre un eliminado falla en la validación.

**Orden de la eliminación lógica:** si falla a mitad de camino, el usuario queda
baneado y desactivado, pero sin `eliminado_en`. Desde la web se ve como
desactivado y se puede volver a eliminar, porque cada paso es idempotente.

**Orden de deploy:** la migración `040_profiles_eliminado.sql` tiene que estar
aplicada antes de deployar esta función o la web: las dos leen
`profiles.eliminado_en`.

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
