# ABM de Usuarios — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ciclo de vida completo de usuarios desde la web (alta por invitación, edición, contraseña, baja reversible), gestionado por superadmin. Épica #224; spec en `docs/superpowers/specs/2026-07-10-abm-usuarios-design.md`.

**Architecture:** Migración 026 agrega `profiles.email` (denormalizado + sync) y `profiles.activo` (soft-delete), con auto-provisioning `handle_new_user` y guard ampliado. Una Edge Function `admin-users` (service_role) concentra las mutaciones de Auth; la web la invoca con `supabase.functions.invoke`. Lecturas siguen por anon key + RLS. Mobile agrega el rol `superadmin` y el gate de `activo`.

**Tech Stack:** Postgres/Supabase (SQL puro), Deno edge function (entry) + lógica pura testeable con vitest, React 18 + vitest + testing-library (web), React Native + jest (mobile).

## Global Constraints

- Un PR por issue, **stack lineal**: `db/225-migracion-026` (base `main`) → `feat/226-edge-function-admin-users` → `web/227-listado-email-estado` → `web/228-alta-invitacion` → `web/229-editar-password-baja` → `mobile/230-activo-superadmin`. Cada PR de GitHub apunta a la rama anterior (lección: retarget del hijo ANTES de borrar la rama mergeada).
- Código y comentarios en español, UN solo idioma. Sin refs a fases/planes/issues en comentarios de código (sí en mensajes de commit y PRs).
- Cero magic constants: códigos de error externos en módulos de constantes (`PG_ERROR`, nuevo módulo para errores de Auth).
- Roles SIEMPRE vía constantes `ROL.*` (web) / helper de rol (mobile), nunca literales.
- Web: sin inline styles; CSS Modules siblings; tests con vitest + supabaseMock existente.
- Verificación antes de cada commit: `cd web && npm run typecheck && npm run lint && npm test` (web); `cd mobile && npx jest && npx jest -c jest.integration.config.js` (mobile).
- Commits `feat(web):` / `fix(db):` etc. + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- PR body: `Closes #NNN` + resumen + "Stacked sobre #PR-anterior" cuando aplique + `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Supuestos nuevos se anotan en `web/ASUMPCIONES_Y_SUPUESTOS.md` en el PR que los introduce.

---

## PR 1 — Issue #225 · Migración 026 (rama `db/225-migracion-026`, base `main`)

### Task 1.1: Migración SQL

**Files:**
- Create: `supabase/migrations/026_abm_usuarios.sql`
- Modify: `supabase/seed.ts` (el insert de profiles choca con el trigger nuevo → upsert)
- Modify: `docs/domain-model.md` (columnas nuevas de profiles)

**Interfaces:**
- Produces: columnas `profiles.email text` y `profiles.activo boolean not null default true`; triggers `trg_handle_new_user`, `trg_sync_profile_email`, `trg_protect_profile_fields` (reemplaza `trg_protect_rol_change`). Mensajes de error del guard (contrato con la web): los dos existentes de rol MÁS `'Solo un superadmin puede modificar el email o el estado de un usuario'`.

- [ ] **Step 1: Escribir la migración completa**

```sql
-- Migration 026: ABM de usuarios
--
-- 1. profiles.email: denormalizado desde auth.users (la web usa anon key y no
--    puede leer auth.users). Backfill + trigger de sincronización.
-- 2. profiles.activo: baja reversible (soft-delete). El bloqueo real de acceso
--    (ban) vive en Auth y lo ejecuta la edge function admin-users; esta columna
--    es la fuente que leen web y mobile para UI y gates.
-- 3. handle_new_user: auto-crea el profile al crear el auth user (dashboard o
--    invitación), leyendo nombre/rol de raw_user_meta_data con defaults seguros.
--    Elimina los usuarios huérfanos (auth.users sin profile).
-- 4. Guard ampliado: activo y email se protegen igual que rol — la policy
--    "Users can update own profile" permitiría a un usuario reactivarse o
--    desincronizar su email a mano.

-- ── 1. Columnas nuevas ───────────────────────────────────────────────────────

alter table profiles add column email text;
alter table profiles add column activo boolean not null default true;

update profiles
set email = u.email
from auth.users u
where profiles.id = u.id and profiles.email is null;

-- ── 2. Auto-provisioning de profiles ─────────────────────────────────────────
-- security definer: corre como owner para poder insertar en public.profiles
-- desde un trigger de auth.users. search_path fijo por seguridad.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Única organización del MVP (la crea el seed); si no existe, queda null.
  org_bayka uuid := (
    select id from public.organizations
    where id = '00000000-0000-0000-0000-000000000001'
  );
  rol_meta text := new.raw_user_meta_data ->> 'rol';
begin
  if rol_meta is null or rol_meta not in ('admin', 'tecnico', 'superadmin') then
    rol_meta := 'tecnico';
  end if;
  insert into public.profiles (id, nombre, rol, organizacion_id, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    rol_meta,
    org_bayka,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 3. Sincronización de email Auth → profiles ───────────────────────────────

create or replace function sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger trg_sync_profile_email
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function sync_profile_email();

-- ── 4. Guard ampliado (reemplaza protect_rol_change de la 024) ───────────────

drop trigger trg_protect_rol_change on profiles;
drop function protect_rol_change();

create or replace function protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  editor_es_superadmin boolean;
begin
  if new.rol is distinct from old.rol
     or new.activo is distinct from old.activo
     or new.email is distinct from old.email then
    -- Conexiones sin usuario (service_role / dashboard / edge function):
    -- permitidas. Es la vía de la función admin-users y del primer superadmin.
    if auth.uid() is null then
      return new;
    end if;
    editor_es_superadmin := exists (
      select 1 from profiles
      where id = auth.uid() and rol = 'superadmin' and activo
    );
    if new.rol is distinct from old.rol then
      if not editor_es_superadmin then
        raise exception 'Solo un superadmin puede cambiar roles';
      end if;
      if old.id = auth.uid() and old.rol = 'superadmin' and new.rol <> 'superadmin' then
        raise exception 'Un superadmin no puede degradarse a sí mismo';
      end if;
    end if;
    if (new.activo is distinct from old.activo or new.email is distinct from old.email)
       and not editor_es_superadmin then
      raise exception 'Solo un superadmin puede modificar el email o el estado de un usuario';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_fields
  before update on profiles
  for each row execute function protect_profile_fields();
```

- [ ] **Step 2: Adaptar `supabase/seed.ts`** — el trigger ahora crea el profile al `createUser`, el `insert` posterior chocaría con PK duplicada. Cambiar el `.insert({...})` del camino feliz (línea ~83) por `.upsert({...}, { onConflict: 'id' })` e incluir `email: user.email` en ambos upserts.

- [ ] **Step 3: Actualizar `docs/domain-model.md`** — sección de profiles: columnas `email` (sincronizada desde Auth) y `activo` (soft-delete), auto-provisioning y guard.

- [ ] **Step 4: Verificar** — `cd web && npm run typecheck && npm run lint && npm test` (nada web cambió: debe seguir verde). Revisión manual del SQL contra la 024 (nombres de policies/trigger exactos).

- [ ] **Step 5: Commit + PR** — `feat(db): migración 026 — email + activo en profiles, auto-provisioning y guard ampliado`. PR base `main`, `Closes #225`.

---

## PR 2 — Issue #226 · Edge Function `admin-users` (rama `feat/226-edge-function-admin-users`, base PR 1)

### Task 2.1: Lógica pura testeable + constantes de error

**Files:**
- Create: `supabase/functions/admin-users/nucleo.ts` (lógica con dependencias inyectadas, SIN imports — testeable con vitest desde web)
- Create: `supabase/functions/admin-users/index.ts` (entry Deno: CORS, parseo, adaptadores de supabase-js)
- Create: `supabase/functions/README.md` (deploy, secrets, SMTP)
- Create: `web/src/test/adminUsersNucleo.test.ts` → NO: el test vive en `supabase/functions/admin-users/nucleo.test.ts` y se incluye en el vitest de web vía `test.include` (ver Task 2.2)

**Interfaces:**
- Produces (contrato HTTP, consumido por PR 4/5): POST JSON
  `{ accion: 'crear', nombre, email, rol }` ·
  `{ accion: 'reenviarInvitacion', email }` ·
  `{ accion: 'desactivar' | 'reactivar' | 'cambiarPassword' | 'cambiarEmail', userId, password?, email? }`.
  Respuesta `200 {ok:true}` o `4xx {ok:false, error:'<mensaje en español>'}`.
- Mensajes de error exactos (contrato con la web):
  - `'Necesitás permisos de superadmin para gestionar usuarios'` (403)
  - `'Un superadmin no puede desactivarse a sí mismo'`
  - `'No podés desactivar al último superadmin activo'`
  - `'No podés cambiar la contraseña de otro superadmin'`
  - `'Ya existe un usuario con ese email'`
  - `'Usuario inexistente'` (404)

- [ ] **Step 1: Escribir `nucleo.ts`** — tipos estructurales para deps:

```ts
// Lógica de admin-users con dependencias inyectadas: el entry de Deno le pasa
// los clientes reales; los tests, mocks. Este archivo no importa nada para
// poder testearse fuera del runtime de Deno.

export type PerfilDb = { id: string; nombre: string; rol: string; activo: boolean };

export type Deps = {
  // Devuelve el perfil del dueño del JWT recibido, o null si el token es inválido.
  perfilDelToken: (jwt: string) => Promise<PerfilDb | null>;
  buscarPerfil: (userId: string) => Promise<PerfilDb | null>;
  contarSuperadminsActivos: () => Promise<number>;
  invitar: (email: string, meta: { nombre: string; rol: string }) => Promise<{ error: string | null }>;
  enviarRecuperacion: (email: string) => Promise<{ error: string | null }>;
  banear: (userId: string, banear: boolean) => Promise<{ error: string | null }>;
  actualizarAuth: (userId: string, campos: { password?: string; email?: string }) => Promise<{ error: string | null }>;
  marcarActivo: (userId: string, activo: boolean) => Promise<{ error: string | null }>;
};
```

`manejarAdminUsers(jwt, cuerpo, deps)` → `{ status: number; body: { ok: boolean; error?: string } }`. Validación: JWT → perfil caller → superadmin activo (403 si no); switch por `accion` con los guards del contrato; validación de payload (email con regex simple, rol ∈ {admin,tecnico,superadmin}, password ≥ 8). El ROL/mensajes como constantes exportadas del módulo.

- [ ] **Step 2: Tests en `nucleo.test.ts`** (vitest, deps mockeadas): caller técnico/admin/inactivo/token inválido → 403; crear feliz + email duplicado; desactivar feliz (banear + marcarActivo llamados), auto-desactivación bloqueada, último superadmin activo bloqueado; reactivar; cambiarPassword feliz + a otro superadmin bloqueado + password corta; cambiarEmail feliz; reenviarInvitacion → enviarRecuperacion.

- [ ] **Step 3: Entry `index.ts`** (Deno): CORS (`Access-Control-Allow-Origin: *`, preflight OPTIONS), lee `Authorization`, arma deps reales con `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`: `perfilDelToken` = `auth.getUser(jwt)` + select profile; `invitar` = `auth.admin.inviteUserByEmail(email, { data: meta, redirectTo: WEB_URL + '/establecer-password' })`; `enviarRecuperacion` = `auth.resetPasswordForEmail` (con mismo redirectTo); `banear` = `auth.admin.updateUserById(id, { ban_duration: banear ? '87600h' : 'none' })`; `actualizarAuth` = `updateUserById`; `marcarActivo` = update profiles. Env: `WEB_URL` (secret de la función).

- [ ] **Step 4: Incluir el test en vitest de web** (Task 2.2) y correr verificación web completa.

- [ ] **Step 5: `supabase/functions/README.md`**: deploy (`supabase functions deploy admin-users`), secrets (`WEB_URL`; SERVICE_ROLE ya inyectado por la plataforma), advertencia de rate limit del SMTP default y recomendación de SMTP propio, y nota de que `reenviarInvitacion` usa el mail de recuperación de contraseña.

- [ ] **Step 6: Commit + PR** — `feat(supabase): edge function admin-users (invitación, ban, contraseña, email)`. Base: rama PR 1. `Closes #226`.

### Task 2.2: Config de vitest para tests fuera de web/src

- [ ] Modificar `web/vite.config.ts` (o `vitest.config.ts` si existe): `test.include` suma `'../supabase/functions/**/*.test.ts'`. Verificar que `npm test` los corre y que `npm run typecheck` no rompe (los archivos de supabase/ quedan fuera del tsconfig de web; si typecheck los toma, excluirlos explícitamente).

---

## PR 3 — Issue #227 · Web: listado con email + estado (rama `web/227-listado-email-estado`, base PR 2)

### Task 3.1: Queries + pantalla

**Files:**
- Modify: `web/src/queries/usuarioQueries.ts` (+ `email`, `activo` en select/tipos/mapeo)
- Modify: `web/src/screens/UsuariosScreen.tsx` + `UsuariosScreen.module.css`
- Modify: `web/src/components/Badge.tsx` (variants `activo`/`inactivo` si el Badge es por-variant)
- Modify tests: `web/src/queries/__tests__/usuarioQueries.test.ts`, `web/src/screens/__tests__/UsuariosScreen.test.tsx`

**Interfaces:**
- Produces: `UsuarioConAsignaciones` gana `email: string | null` y `activo: boolean` (PR 5 los consume).

- [ ] **Step 1 (test-first):** actualizar fixtures de tests con `email`/`activo` y agregar casos: email visible como línea secundaria; badge Inactivo; filtro por estado compone con el de rol; email null muestra '—'.
- [ ] **Step 2:** queries: select `id, nombre, rol, organizacion_id, created_at, email, activo`; tipos y mapeo.
- [ ] **Step 3:** pantalla: `CeldaUsuario` línea secundaria = email (reemplaza organización — era el placeholder por falta de email; anotar supuesto en ASUMPCIONES); columna nueva "Estado" con badge Activo/Inactivo; `SegmentedControl` segundo filtro Todos/Activos/Inactivos (aria-label "Filtrar por estado").
- [ ] **Step 4:** verificación web completa; commit `feat(web): listado de usuarios con email y estado` + PR base rama PR 2, `Closes #227`.

---

## PR 4 — Issue #228 · Web: alta por invitación + establecer contraseña (rama `web/228-alta-invitacion`, base PR 3)

### Task 4.1: Service de invocación

**Files:**
- Create: `web/src/services/adminUsersService.ts`
- Create: `web/src/services/__tests__/adminUsersService.test.ts`
- Modify: `web/src/test/supabaseMock.ts` (agregar `functions.invoke` + `auth.updateUser` configurables)

**Interfaces:**
- Produces: `crearUsuario({nombre, email, rol})`, `reenviarInvitacion(email)`, `desactivarUsuario(userId)`, `reactivarUsuario(userId)`, `cambiarPassword(userId, password)`, `cambiarEmail(userId, email)` — todas `Promise<void>`, lanzan `Error` con el mensaje en español del backend (o genérico `'No se pudo completar la operación. Probá de nuevo.'`).

- [ ] **Step 1 (test-first):** tests del service: payload correcto a `functions.invoke('admin-users', {body})`; error del backend (`{ok:false,error}`) → `Error(mensaje)`; error de red → mensaje genérico.
- [ ] **Step 2:** implementar wrapper único `invocar(accion, params)` + funciones nombradas (DRY).

### Task 4.2: Modal de alta real

**Files:**
- Modify: `web/src/screens/UsuariosScreen.tsx` (AgregarUsuarioModal → formulario) + css + test

- [ ] **Step 1 (test-first):** reescribir el test de "Agregar usuario": formulario con Nombre/Email/Rol (default Técnico), submit llama `crearUsuario`, éxito cierra e invalida `['usuarios']`, error se muestra `role="alert"`, validación local (email inválido / nombre vacío deshabilita).
- [ ] **Step 2:** implementar con `Input`/`Select`/`Button` del kit + advertencia superadmin reutilizada. Nota de copy: "Le va a llegar un email para definir su contraseña."
- [ ] **Step 3:** verificación completa.

### Task 4.3: Página pública Establecer contraseña

**Files:**
- Create: `web/src/screens/EstablecerPasswordScreen.tsx` + `.module.css` + test
- Modify: `web/src/App.tsx` (ruta `/establecer-password` FUERA de `RequireAccess`, junto a `/login`)

- [ ] **Step 1 (test-first):** con sesión (mock `getSession`): form contraseña + confirmación (mín. 8, deben coincidir), submit llama `auth.updateUser({password})`, éxito muestra "Contraseña lista" + link a `/login` y aclaración para técnicos ("entrá desde la app Bayka"). Sin sesión: mensaje "El link expiró o ya fue usado. Pedí que te reenvíen la invitación."
- [ ] **Step 2:** implementar (patrón visual de LoginScreen). El SDK procesa el token del hash automáticamente (`detectSessionInUrl`).
- [ ] **Step 3:** verificación completa; commit `feat(web): alta de usuario por invitación y página de establecer contraseña` + PR base rama PR 3, `Closes #228`. Actualizar `web/ASUMPCIONES_Y_SUPUESTOS.md`: A5 superada (referenciar #224).

---

## PR 5 — Issue #229 · Web: editar, contraseña, baja (rama `web/229-editar-password-baja`, base PR 4)

### Task 5.1: Menú de acciones por fila + modales

**Files:**
- Create: `web/src/components/MenuAccionesUsuario.tsx` (dropdown accesible: botón ⋯ abre menú con ítems) + css
- Modify: `web/src/screens/UsuariosScreen.tsx` (reemplaza el botón único "Cambiar rol" por el menú: Cambiar rol / Editar / Cambiar contraseña / Reenviar invitación / Desactivar|Reactivar) + css + tests
- Modify: `web/src/repositories/profileRepository.ts` (`actualizarNombre(userId, nombre)` — update directo, policy superadmin existente)

**Reglas UI (deshabilitado con `title` explicativo, nunca oculto):**
- Cambiar rol: reglas existentes; `totalSuperadmins` pasa a contar solo superadmins **activos**.
- Cambiar contraseña: deshabilitado si el objetivo es superadmin y no soy yo → `'No podés cambiar la contraseña de otro superadmin'`. (Cambiar la propia sí.)
- Desactivar: deshabilitado para mí mismo (`'Un superadmin no puede desactivarse a sí mismo'`) y para el último superadmin activo (`'No podés desactivar al último superadmin activo'`). Usuario inactivo → la acción es "Reactivar".

**Modales:**
- Editar: nombre (`actualizarNombre`) + email (`cambiarEmail` del service); solo envía lo que cambió.
- Cambiar contraseña: contraseña + confirmación (mín. 8).
- Desactivar: confirmación §15 con copy: pierde acceso a la app y a la web al reconectar; si está offline sigue operando hasta reconectar; sus datos de campo se conservan. Reactivar: confirmación simple.

- [ ] **Step 1 (test-first):** tests por acción: happy path (mutación correcta + invalidación), guard deshabilitado con title, error del server visible en modal. Ajustar tests existentes al menú nuevo (los `aria-label` "Cambiar rol de X" pasan al ítem del menú).
- [ ] **Step 2:** implementar menú + modales (componentes chicos, lógica de motivos en funciones puras testeables).
- [ ] **Step 3:** verificación completa; commit `feat(web): editar usuario, cambiar contraseña y baja reversible` + PR base rama PR 4, `Closes #229`.

---

## PR 6 — Issue #230 · Mobile: activo + superadmin (rama `mobile/230-activo-superadmin`, base PR 5)

### Task 6.1: Rol superadmin

**Files:**
- Modify: `mobile/src/types/domain.ts` — `export type Role = 'admin' | 'tecnico' | 'superadmin';` + helper:

```ts
/** Roles con capacidades de administración en la app (el superadmin de la
 *  web opera en campo igual que un admin). */
export function esRolAdmin(rol: Role | string | null | undefined): boolean {
  return rol === 'admin' || rol === 'superadmin';
}
```

- Modify (sweep completo, lección state-lifecycle): TODOS los checks de igualdad con `'admin'` pasan a `esRolAdmin(...)`. Conocidos: `app/_layout.tsx:80` (routing de grupos), `src/hooks/useNNResolution.ts:44`; grep exhaustivo `rol === |role === |isAdmin` en `src/` y `app/` (incluye `dashboardQueries`, `catalogQueries`, `CatalogScreen`, `PlantacionesScreen`, `AdminBottomSheet`, `PlantationCard`, `usePlantaciones`, `useCatalog`) y actualizar cada consumidor + su test.

### Task 6.2: Gate de activo

**Files:**
- Modify: `mobile/src/hooks/useAuth.ts` — `fetchAndCacheRole` selecciona `rol, activo`; si `activo === false` (respuesta ONLINE explícita) NO cachea y devuelve un marcador de cuenta desactivada; los tres llamadores (init online, SIGNED_IN, persistOnlineSession) ante ese marcador ejecutan `signOut()` (borrado de keys legítimo: es un signOut explícito mandado por el server). El fallback offline/timeout al rol cacheado NO cambia (contrato offline intacto).
- Mensaje al usuario: `'Tu cuenta fue desactivada. Contactá a un administrador.'` mostrable en la pantalla de login (mismo mecanismo que los mensajes de `authErrors`).

- [ ] **Step 1 (test-first):** tests jest de useAuth: perfil online con `activo=false` → signOut + sin rol cacheado; offline → contrato intacto (cero llamadas, keys intactas); superadmin rutea a `(admin)`.
- [ ] **Step 2:** implementar; correr `npx jest` Y `npx jest -c jest.integration.config.js`.
- [ ] **Step 3:** commit `feat(mobile): gate de cuenta desactivada y soporte de rol superadmin` + PR base rama PR 5, `Closes #230`.

---

## Verificación final de la épica

- [ ] Las 6 verificaciones por-PR verdes (web typecheck/lint/vitest; mobile jest ×2).
- [ ] `git diff` de cada PR revisado contra su issue (criterios de verificación punto por punto).
- [ ] Code-review (skill /code-review) sobre el stack completo, incluyendo dimensión de magic constants.
- [ ] Actualizar cada issue de GitHub con resultado + supuestos; épica #224 con resumen y pendientes de deploy (migraciones 023–026 en prod, deploy de la función, secret WEB_URL, SMTP).
