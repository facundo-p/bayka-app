-- Migration 026: ABM de usuarios
--
-- 1. profiles.email: denormalizado desde auth.users (la web usa anon key y no
--    puede leer auth.users). Backfill + trigger de sincronización.
-- 2. profiles.activo: baja reversible (soft-delete). El bloqueo real de acceso
--    (ban) vive en Auth y lo ejecuta la edge function admin-users; esta columna
--    es la fuente que leen web y mobile para UI y gates.
-- 3. handle_new_user: auto-crea el profile al crear el auth user (dashboard o
--    invitación), leyendo nombre/rol de raw_user_meta_data con defaults seguros
--    (rol tecnico, organización Bayka). Elimina el riesgo de usuarios huérfanos
--    (auth.users sin fila en profiles, invisibles para la web).
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

-- Auth users huérfanos preexistentes (sin profile): se les crea uno con los
-- mismos defaults del auto-provisioning de abajo.
insert into profiles (id, nombre, rol, organizacion_id, email)
select
  u.id,
  -- nombre NOT NULL: un auth user sin email (alta out-of-band) no debe abortar
  -- la migración entera.
  coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Usuario'),
  'tecnico',
  (select id from organizations where id = '00000000-0000-0000-0000-000000000001'),
  u.email
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

-- ── 2. Auto-provisioning de profiles ─────────────────────────────────────────
-- security definer: corre como owner para poder insertar en public.profiles
-- desde un trigger sobre auth.users. search_path fijo por seguridad.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Única organización del MVP (la crea el seed); si no existe, queda null.
  org_bayka uuid := (
    select id from public.organizations
    where id = '00000000-0000-0000-0000-000000000001'
  );
begin
  -- SIEMPRE 'tecnico': el rol NUNCA se toma de raw_user_meta_data. En un signUp
  -- con la anon key esa metadata la controla el cliente, así que confiar en
  -- ella sería una escalación de privilegios (cualquiera se haría superadmin).
  -- El rol elevado lo setea la edge function admin-users con service_role
  -- después de invitar, no el alta.
  insert into public.profiles (id, nombre, rol, organizacion_id, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nombre', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    'tecnico',
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
-- rol: editable por un superadmin activo con su JWT (vía cambiarRol en la web),
--   con la misma protección de no autodegradarse.
-- activo y email: SOLO service_role (auth.uid() is null), es decir la edge
--   function admin-users. Razones:
--   · activo — la baja también banea en Auth; permitir un UPDATE directo del
--     JWT daría un estado split-brain (activo=false sin ban) y podría dejar la
--     org sin ningún superadmin activo (lockout), guard que solo vive en la
--     función. Forzando el service_role, esos guards de negocio siempre corren.
--   · email — es una copia denormalizada cuya única fuente es auth.users (la
--     sincroniza sync_profile_email, service_role). Un UPDATE directo la
--     desincronizaría de la fuente en silencio.

drop trigger trg_protect_rol_change on profiles;
drop function protect_rol_change();

create or replace function protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  editor_es_superadmin boolean;
begin
  -- Conexiones sin usuario (service_role / dashboard / edge function): permitidas.
  if auth.uid() is null then
    return new;
  end if;
  if new.activo is distinct from old.activo or new.email is distinct from old.email then
    raise exception 'El email y el estado de un usuario solo se cambian desde la gestión de usuarios';
  end if;
  if new.rol is distinct from old.rol then
    editor_es_superadmin := exists (
      select 1 from profiles
      where id = auth.uid() and rol = 'superadmin' and activo
    );
    if not editor_es_superadmin then
      raise exception 'Solo un superadmin puede cambiar roles';
    end if;
    if old.id = auth.uid() and old.rol = 'superadmin' and new.rol <> 'superadmin' then
      raise exception 'Un superadmin no puede degradarse a sí mismo';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_fields
  before update on profiles
  for each row execute function protect_profile_fields();
