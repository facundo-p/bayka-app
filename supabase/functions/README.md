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

## admin-plantaciones

Borrado real de plantaciones (#478). Necesita service_role para borrar las
fotos de Storage; el borrado de los datos se autoriza en SQL.

| Acción | Payload | Efecto |
|--------|---------|--------|
| `eliminar` | `{accion, plantacionId, nombreConfirmacion?}` | RPC `eliminar_plantacion` **con el JWT del caller**; si sale bien, borra con service_role todo `tree-photos/plantations/{id}/` (listado recursivo, tandas de 100) y marca `plantaciones_eliminadas.fotos_limpias = true`. Responde `{ok, resumen, fotosPendientes}` |
| `limpiarFotos` | `{accion, plantacionId?}` | Solo superadmin activo. Reintenta el borrado de fotos de las eliminadas de su organización con `fotos_limpias = false`. Responde `{ok, limpiadas, pendientes}` |

- **Autorización de `eliminar`:** la decide el RPC (admin sin datos; con datos,
  superadmin, archivada y con el nombre). Sus códigos se traducen a mensajes
  en español (403 sin permiso, 409 reglas de negocio).
- **Falla de Storage:** los datos ya se borraron, así que responde éxito con
  `fotosPendientes: true`; la fila queda con `fotos_limpias = false` para
  `limpiarFotos`. En la web, un superadmin lo reintenta con el botón
  "Reintentar limpieza de fotos" del resultado de eliminar (#523); para
  pendientes viejas no hay UI y se invoca sin `plantacionId`.
- **`plantacionId` tiene que ser un uuid:** un id vacío armaría un prefijo que
  abarca las fotos de todas las plantaciones.

Misma estructura que `admin-users`: `nucleo.ts` sin imports (tests en la suite
vitest de la web) e `index.ts` como entry de Deno.

### Deploy

```bash
supabase functions deploy admin-plantaciones
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta
la plataforma. Requiere la migración `039_eliminar_plantacion.sql` aplicada.
