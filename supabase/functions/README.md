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
supabase secrets set WEB_URL=https://<dominio-de-la-web>
supabase functions deploy admin-users
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma.
`WEB_URL` es la base de los links de invitación/recuperación
(`<WEB_URL>/establecer-password`).

**Cambiar `WEB_URL` exige redeployar `admin-users`.** `index.ts` lee el secret
a nivel de módulo, una sola vez al arrancar el worker: un worker caliente
sigue armando links con el valor viejo aunque el dashboard ya muestre el
nuevo. El síntoma es una invitación cuyo link apunta a la URL anterior (pasó
con `http://localhost:5173`, #325). Orden: primero el secret, después
`supabase functions deploy admin-users`.

| Entorno | Proyecto | `WEB_URL` |
|---|---|---|
| staging | `uchejlyyabtrjoxyydmb` | `https://staging.bayka-app.pages.dev` |
| prod | `mgtaeogxzuavxrfhrefi` | `https://bayka-app.pages.dev` |

### Allowlist de Redirect URLs

`<WEB_URL>/establecer-password` tiene que estar permitido en Authentication →
URL Configuration → Redirect URLs del mismo proyecto; si no, Auth ignora el
`redirectTo` y manda al Site URL pelado. Para verificarlo sin gastar mails
(el SMTP default admite ~2 por hora), pedir un verify con token inválido y
mirar el `Location`:

```bash
curl -s -o /dev/null -D - "https://<ref>.supabase.co/auth/v1/verify?token=x&type=invite&redirect_to=https://<web>/establecer-password" \
  | grep -i '^location'
```

- `Location` conserva el path `/establecer-password` (con un `error=` en el
  fragmento): la URL está permitida.
- `Location` es el Site URL sin path: la URL está rechazada, falta en la
  allowlist.

`http://localhost:5173/**` no está en la allowlist de staging: el flujo de
invitación no se prueba contra `npm run dev`, se prueba en la web de staging.

### Checklist por entorno (cutover o proyecto nuevo)

- [ ] `supabase secrets set WEB_URL=<url de la web de ese entorno>`
- [ ] `supabase functions deploy admin-users` y `admin-plantaciones`
- [ ] URL Configuration: Site URL = la web del entorno; Redirect URLs con
      `<web>/**` (y `https://*.bayka-app.pages.dev/**` solo en staging, para
      los previews de PR). La URL de prod no va en la allowlist de staging.
- [ ] Verificar la allowlist con el `curl` de arriba.
- [ ] Migraciones que las functions requieren aplicadas (ver cada función).

El resto de la config manual del proyecto (registro público cerrado, SMTP,
proveedores) está en [`docs/supabase-config-manual.md`](../../docs/supabase-config-manual.md).

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
