# ABM de usuarios en la web de gestión — Diseño

**Fecha:** 2026-07-10
**Estado:** Aprobado (diseño). Pendiente de implementación.
**Épica:** #224 (sub-issues #225–#230).
**Antecedente:** issue #136 (cerrado — entregó listado + cambio de rol; el alta quedó
fuera de v1 por decisión A5 de `web/ASUMPCIONES_Y_SUPUESTOS.md`).

## Objetivo

Que un superadmin administre el ciclo de vida completo de los usuarios desde la web:
alta por invitación, edición (nombre/email), cambio de contraseña, desactivación y
reactivación. Hoy la web solo lista usuarios, cambia roles y asigna plantaciones; el
alta es manual por dashboard de Supabase y no existe la baja.

## Decisiones (aprobadas por Facu, 2026-07-10)

1. **Alta por invitación** vía Edge Function con service_role: el superadmin carga
   nombre + email + rol; Supabase envía email de invitación y el usuario define su
   contraseña. Además, el superadmin puede cambiar la contraseña de un usuario
   desde la web.
2. **Baja = soft-delete**: `profiles.activo = false` + ban en Supabase Auth. Los
   datos de campo del usuario (árboles, subgrupos) quedan intactos. Reversible.
   Hard-delete queda descartado (las FKs de `trees`/`subgroups` lo bloquean, y eso
   es correcto).
3. **Email denormalizado** en `profiles.email`, sincronizado desde `auth.users` por
   trigger, con backfill de los existentes. El listado lo lee directo con anon key.
4. **Mono-organización fija** (Bayka). Sin selector de organización en la UI.
   Multi-org real requeriría rediseñar RLS y es otro proyecto.
5. **Contraseñas entre pares**: un superadmin puede cambiar la contraseña de admins
   y técnicos, pero **no** la de otro superadmin (vector de toma de cuenta). Un
   superadmin que olvidó la suya usa el reset por email.

## Arquitectura

Una única **Edge Function** `supabase/functions/admin-users/` concentra todas las
operaciones privilegiadas (necesitan Auth Admin API / service_role, que no puede
vivir en el cliente estático):

- `crear`: `auth.admin.inviteUserByEmail(email, { data: { nombre, rol } })`.
- `desactivar` / `reactivar`: ban/unban en Auth + `profiles.activo`.
- `cambiarPassword`: `auth.admin.updateUserById(id, { password })`.
- `cambiarEmail`: `auth.admin.updateUserById(id, { email })` (el trigger de sync
  actualiza `profiles.email`).

**Autorización**: la función valida el JWT del caller y exige `rol = 'superadmin'`
y `activo = true` en su profile antes de operar. Errores en español, siguiendo el
patrón de mensajes existente.

Las **lecturas** (listado de usuarios) siguen siendo queries directas a Postgres
con anon key + RLS, como hoy. La Edge Function solo interviene en mutaciones que
tocan Auth.

## Cambios de schema (migración 026)

- `profiles.email text` + backfill desde `auth.users` + trigger de sincronización
  ante cambios de email en Auth.
- `profiles.activo boolean not null default true`.
- Trigger `handle_new_user` sobre `auth.users`: auto-crea el profile leyendo
  `raw_user_meta_data` (nombre, rol; defaults: rol `tecnico`, org Bayka). Elimina
  el riesgo de usuarios huérfanos incluso si se crean por dashboard.
- Extender el guard `trg_protect_rol_change` (migración 024) para proteger también
  `activo` y `email`: hoy la policy "Users can update own profile" permitiría a un
  usuario reactivarse o desincronizar su email a mano.

**Precondición**: aplicar antes en prod las migraciones 023/024 pendientes.

## Reglas de negocio

- Un superadmin no puede desactivarse a sí mismo.
- No se puede desactivar al último superadmin activo (espejo del guard de roles).
- No se puede cambiar la contraseña de otro superadmin (decisión 5).
- Desactivar banea en Auth → el refresh token muere; el usuario queda afuera de
  mobile y web al reconectar.

## Impacto en mobile

- `useAuth` mobile debe rechazar un perfil con `activo = false` al validar online.
  **Offline el contrato actual se mantiene**: la sesión cacheada sigue operando
  hasta reconectar, donde el ban la corta. Es el comportamiento esperado y se
  documenta, no se evita.
- El tipo `Role` de mobile no incluye `superadmin`: agregarlo y auditar los checks
  de igualdad estricta con `'admin'` para que un superadmin opere en campo.

## UI web (`/usuarios`, sigue siendo solo superadmin)

- Listado: columna email, badge de estado Activo/Inactivo, filtro por estado.
- "Agregar usuario": el modal informativo pasa a formulario real (nombre, email,
  rol) → Edge Function → estados de éxito/error, y reenvío de invitación si el
  link expiró.
- Acciones por fila: editar (nombre/email), cambiar contraseña, desactivar /
  reactivar. Confirmación explícita en las destructivas (§15 de la guía UX),
  explicitando qué pierde el usuario (acceso mobile+web) y qué se conserva
  (datos de campo).
- Página pública de **establecer contraseña** (destino del link de invitación),
  fuera del gate `RequireAccess` — los técnicos la usan una sola vez desde el
  navegador aunque no tengan acceso a la web de gestión.

## Casos borde

- Invitar un email ya registrado → error claro (traducir el error de Auth).
- Metadata faltante en `handle_new_user` → defaults seguros.
- Link de invitación expirado → acción de reenvío.
- Técnico offline desactivado → opera hasta reconectar (documentado).
- El email por defecto de Supabase tiene rate limit bajo; para uso productivo del
  alta por invitación conviene configurar SMTP propio (flag en el issue de la
  Edge Function).

## Fuera de alcance

- Multi-organización y RLS por organización.
- Hard-delete de usuarios.
- Cambio de contraseña de un superadmin por otro superadmin.
- Alta/gestión de usuarios desde mobile.

## Descomposición en issues (uno por PR)

| Issue | Contenido | Depende de |
|-------|-----------|-----------|
| #225 | DB: migración 026 (email + activo + auto-provisioning + guards) | — |
| #226 | Edge Function `admin-users` (setup inicial de `supabase/functions/`) | #225 |
| #227 | Web: listado enriquecido (email, estado, filtro) | #225 |
| #228 | Web: alta por invitación + página de establecer contraseña | #226 |
| #229 | Web: editar, cambiar contraseña, desactivar/reactivar | #226, #227 |
| #230 | Mobile: gate de `activo` + rol superadmin | #225 |

#227 y #230 pueden ir en paralelo con #226. La documentación (`docs/domain-model.md`,
`web/ASUMPCIONES_Y_SUPUESTOS.md` — A5 queda superada, `docs/SPECS.md`) se
actualiza dentro de cada PR que la desactualice.
