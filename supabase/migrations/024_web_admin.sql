-- Migration 024: base de datos para la web de gestión (issue #128)
--
-- 1. profiles.rol: se agrega 'superadmin' al CHECK. Jerarquía resultante:
--    superadmin (toda la web + gestión de usuarios) > admin (toda la web
--    salvo gestión de usuarios) > tecnico (sin acceso a la web).
-- 2. plantations: campos nuevos editables desde la web. Todos opcionales o
--    con DEFAULT: los clientes mobile viejos no los envían y sync_subgroup
--    no se modifica.
--    - visible_in_app: si la plantación se muestra a los técnicos en la
--      Bayka App (default true: las existentes no cambian de comportamiento).
-- 3. Políticas RLS de escritura que hoy exigen rol 'admin' pasan a aceptar
--    también 'superadmin' (un superadmin puede operar todo lo que un admin).
-- 4. Cambios de rol: solo un superadmin puede modificar profiles.rol, y no
--    puede degradarse a sí mismo (evita perder el último acceso total).
--    El primer superadmin se promueve desde el dashboard de Supabase
--    (conexión service_role, sin auth.uid(), exenta del guard).

-- ── 1. Rol superadmin ────────────────────────────────────────────────────────

alter table profiles drop constraint profiles_rol_check;
alter table profiles
  add constraint profiles_rol_check check (rol in ('admin', 'tecnico', 'superadmin'));

-- ── 2. Campos nuevos de plantations ──────────────────────────────────────────

alter table plantations add column descripcion text;
alter table plantations add column fecha_inicio date;
alter table plantations add column superficie_ha numeric check (superficie_ha > 0);
alter table plantations add column ubicacion_lat double precision
  check (ubicacion_lat between -90 and 90);
alter table plantations add column ubicacion_lng double precision
  check (ubicacion_lng between -180 and 180);
alter table plantations add column objetivo_arboles integer check (objetivo_arboles >= 1);
alter table plantations add column visible_in_app boolean not null default true;

-- ── 3. Políticas admin → admin o superadmin ──────────────────────────────────
-- Mismo cuerpo que las políticas originales (003 y 021), con el rol ampliado.

drop policy "Admin can insert plantations" on plantations;
create policy "Admin can insert plantations" on plantations
  for insert to authenticated
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can update plantations" on plantations;
create policy "Admin can update plantations" on plantations
  for update to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ))
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can insert plantation_species" on plantation_species;
create policy "Admin can insert plantation_species" on plantation_species
  for insert to authenticated
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can update plantation_species" on plantation_species;
create policy "Admin can update plantation_species" on plantation_species
  for update to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ))
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can delete plantation_species" on plantation_species;
create policy "Admin can delete plantation_species" on plantation_species
  for delete to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can insert plantation_users" on plantation_users;
create policy "Admin can insert plantation_users" on plantation_users
  for insert to authenticated
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can delete plantation_users" on plantation_users;
create policy "Admin can delete plantation_users" on plantation_users
  for delete to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can insert parcelas" on parcelas;
create policy "Admin can insert parcelas" on parcelas
  for insert to authenticated
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can update parcelas" on parcelas;
create policy "Admin can update parcelas" on parcelas
  for update to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ))
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

drop policy "Admin can delete parcelas" on parcelas;
create policy "Admin can delete parcelas" on parcelas
  for delete to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

-- ── 4. Gestión de roles ──────────────────────────────────────────────────────
-- Un superadmin puede editar cualquier perfil (la política existente de
-- "update own profile" sigue cubriendo la autoedición de nombre).

create policy "Superadmin can update profiles" on profiles
  for update to authenticated
  using (exists (
    select 1 from profiles as editor
    where editor.id = auth.uid() and editor.rol = 'superadmin'
  ))
  with check (exists (
    select 1 from profiles as editor
    where editor.id = auth.uid() and editor.rol = 'superadmin'
  ));

-- Guard a nivel fila: el cambio de rol exige superadmin aunque la fila sea
-- propia (la política de autoedición permitiría a un admin subirse el rol).
-- security definer: lee profiles sin que el RLS del editor interfiera.
create or replace function protect_rol_change() returns trigger
language plpgsql security definer as $$
begin
  if new.rol is distinct from old.rol then
    -- Conexiones sin usuario (service_role / dashboard): permitidas. Es la
    -- vía para promover al primer superadmin.
    if auth.uid() is null then
      return new;
    end if;
    if not exists (
      select 1 from profiles where id = auth.uid() and rol = 'superadmin'
    ) then
      raise exception 'Solo un superadmin puede cambiar roles';
    end if;
    if old.id = auth.uid() and old.rol = 'superadmin' and new.rol <> 'superadmin' then
      raise exception 'Un superadmin no puede degradarse a sí mismo';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_rol_change
  before update on profiles
  for each row execute function protect_rol_change();
