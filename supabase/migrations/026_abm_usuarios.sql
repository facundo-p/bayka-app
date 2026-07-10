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
  split_part(u.email, '@', 1),
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
-- Mismos mensajes para rol (la web los muestra tal cual); se suma la
-- protección de activo y email. Un superadmin desactivado no puede editar.

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
    -- permitidas. Es la vía de admin-users y del primer superadmin.
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
