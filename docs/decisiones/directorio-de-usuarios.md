# Decisión: todo usuario de la organización ve el directorio completo

Estado: **decidido (2026-09-29)** · Alcance: Supabase RLS de `profiles` + web
de gestión + Bayka App

## Contexto

La policy de lectura de `profiles` (`033_membership_scoped_select.sql:59`) es:

```sql
create policy "Members can read org profiles"
  on profiles for select
  to authenticated
  using (organizacion_id = current_organizacion_id());
```

Desde la 050, `current_organizacion_id()` devuelve `NULL` para un perfil
inactivo, así que solo aplica a usuarios activos.

Como el MVP tiene una sola organización, en la práctica cualquier usuario activo
—técnicos incluidos— lee nombre, email y rol de todos los usuarios del cliente.
Es la excepción del modelo: plantaciones, parcelas, grupos, árboles y fotos se
scopean por membresía (`plantation_users`). La pregunta de #608 fue si un
técnico debe poder ver ese directorio completo.

## Decisión

**Sí.** La policy queda como está y el scope de `profiles` sigue siendo la
organización, no la membresía.

## Por qué

- El cliente es una empresa chica: los técnicos se conocen entre sí y con los
  admins. El directorio no expone nada que no sepan ya.
- Nombre, email y rol no son datos sensibles dentro de la organización. Lo que
  sí importa aislar son los datos de campo, y eso ya lo hace la membresía.
- Scopear por membresía tiene costo real y ningún beneficio hoy: obliga a
  revisar cada consumidor de `profiles` y arriesga dejar árboles sin el nombre
  de quien los registró.

Lo que esta decisión **no** cubre es un intruso: que alguien ajeno entre a la
organización. Eso lo frena el registro público cerrado (#606,
[`supabase-config-manual.md`](../supabase-config-manual.md)).

## Cuándo revisarla

- Entra una **segunda organización** que comparta usuarios o técnicos con la
  primera, o un modelo multi-cliente donde la organización deje de equivaler a
  "una empresa donde todos se conocen".
- Entran **técnicos externos** (contratistas, personal temporal de otra
  empresa) que no deberían conocer al resto del plantel.

## Si esta decisión cambiara

El scope pasaría a "usuarios con los que comparto al menos una plantación, **o**
soy admin". Implicaría:

1. Una policy nueva de `SELECT` en `profiles` con esa condición. El
   `or is_admin()` no es opcional: el ABM de usuarios de la web lee `profiles`
   con el JWT del usuario, no con service_role (`web/src/queries/usuarioQueries.ts`).
2. Revisar uno por uno los consumidores de `profiles`:
   - `web/src/queries/usuarioQueries.ts` — ABM (admin).
   - `web/src/repositories/profileRepository.ts`
   - `mobile/src/queries/adminQueries.ts`
   - `mobile/src/hooks/useUserNames.ts` — nombres de quién registró cada árbol.
     El caso más delicado: si un técnico deja de ver a otro, los registros de
     ese otro podrían quedar sin nombre en la UI.
   - `mobile/src/hooks/useProfileData.ts`, `mobile/src/hooks/useAuth.ts` —
     perfil propio, cubiertos por `Users can read own profile`.
3. Verificar, con pgTAP y en staging:
   - Un técnico no lee perfiles de usuarios con los que no comparte plantación.
   - Un técnico **sí** ve el nombre de quien registró cada árbol que puede ver.
   - El ABM de usuarios de la web sigue listando a todos para admin y
     superadmin.
   - El perfil propio se sigue leyendo aun sin organización: es como la web y
     la app detectan la cuenta dada de baja (ver la nota de la 050).

La policy ya se reescribió dos veces (033, 050). No tocarla sin reabrir esta
decisión.
