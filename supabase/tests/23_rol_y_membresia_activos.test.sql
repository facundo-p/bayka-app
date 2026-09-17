-- Un perfil inactivo no pasa gates por rol ni por membresía (045, #508). Cada
-- policy de admin reescrita y cada camino por membresía tiene un caso activo y
-- uno inactivo.
begin;
select plan(37);

insert into organizations (id, nombre) values
  ('b2300000-0000-0000-0000-000000000001', 'Org Test 23');

insert into auth.users (id, email) values
  ('b2300000-0000-0000-0000-0000000000a1', 'admin-23@test.local'),
  ('b2300000-0000-0000-0000-0000000000a2', 'admin-inactivo-23@test.local'),
  ('b2300000-0000-0000-0000-0000000000a3', 'super-23@test.local'),
  ('b2300000-0000-0000-0000-0000000000a4', 'super-inactivo-23@test.local'),
  ('b2300000-0000-0000-0000-0000000000a5', 'tecnico-23@test.local'),
  ('b2300000-0000-0000-0000-0000000000a6', 'tecnico-inactivo-23@test.local'),
  ('b2300000-0000-0000-0000-0000000000a7', 'sin-membresia-23@test.local');

update profiles set organizacion_id = 'b2300000-0000-0000-0000-000000000001'
  where id::text like 'b2300000-%';
update profiles set rol = 'admin'
  where id in ('b2300000-0000-0000-0000-0000000000a1', 'b2300000-0000-0000-0000-0000000000a2');
update profiles set rol = 'superadmin'
  where id in ('b2300000-0000-0000-0000-0000000000a3', 'b2300000-0000-0000-0000-0000000000a4');

-- Activos al crear la plantación: el trigger les da membresía a todos los admin.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-000000000001',
   'Plantación 23', '2026', 'b2300000-0000-0000-0000-0000000000a1');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b2300000-0000-0000-0000-000000000011', 'b2300000-0000-0000-0000-000000000010', 'P23', 'P23');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-0000000000a5', 'tecnico'),
  ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-0000000000a6', 'tecnico');

insert into species (id, codigo, nombre) values
  ('b2300000-0000-0000-0000-000000000020', 'SP23', 'Especie 23'),
  ('b2300000-0000-0000-0000-000000000021', 'SP23b', 'Especie 23b');

insert into plantation_species (plantation_id, species_id) values
  ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-000000000020');

-- Desactivar después de dar las membresías: es el caso real, y sin claim (como la
-- edge function) el guard de profiles lo permite.
update profiles set activo = false
  where id in ('b2300000-0000-0000-0000-0000000000a2', 'b2300000-0000-0000-0000-0000000000a4',
               'b2300000-0000-0000-0000-0000000000a6');

select is(
  (select count(*)::int from plantation_users
    where plantation_id = 'b2300000-0000-0000-0000-000000000010'
      and user_id in ('b2300000-0000-0000-0000-0000000000a2', 'b2300000-0000-0000-0000-0000000000a4',
                      'b2300000-0000-0000-0000-0000000000a6')),
  3, 'fixture: los inactivos conservan su membresía'
);

-- Las policies de SELECT ya ocultan las filas a un inactivo, y un UPDATE o DELETE
-- solo alcanza filas visibles: sin esto los casos de abajo pasarían aun sin 045.
create policy "test 23 lectura plantations" on plantations for select to authenticated using (true);
create policy "test 23 lectura plantation_species" on plantation_species for select to authenticated using (true);
create policy "test 23 lectura plantation_users" on plantation_users for select to authenticated using (true);

create temp table payload_23 as
select jsonb_build_object(
  'id', 'b2300000-0000-0000-0000-000000000030',
  'plantation_id', 'b2300000-0000-0000-0000-000000000010',
  'parcela_id', 'b2300000-0000-0000-0000-000000000011',
  'nombre', 'G23', 'codigo', 'G23', 'tipo', 'linea', 'estado', 'activa',
  'usuario_creador', 'b2300000-0000-0000-0000-0000000000a5',
  'created_at', now()::text
) as grupo;
grant select on payload_23 to authenticated;

set local role authenticated;

-- ── Helpers ──────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a5', true);
select is(is_plantation_member('b2300000-0000-0000-0000-000000000010'), true,
  'técnico activo: es miembro');
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a6', true);
select is(is_plantation_member('b2300000-0000-0000-0000-000000000010'), false,
  'técnico inactivo: no es miembro aunque tenga la fila');
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a2', true);
select is(is_plantation_member('b2300000-0000-0000-0000-000000000010'), false,
  'admin inactivo: no es miembro aunque tenga la fila');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a3', true);
select is(is_superadmin(), true, 'superadmin activo: pasa is_superadmin()');
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a4', true);
select is(is_superadmin(), false, 'superadmin inactivo: no pasa is_superadmin()');
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a1', true);
select is(is_superadmin(), false, 'admin activo: no pasa is_superadmin()');

-- ── Lectura por membresía ────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a5', true);
select is((select count(*)::int from parcelas where plantation_id = 'b2300000-0000-0000-0000-000000000010'),
  1, 'técnico activo: lee las parcelas');
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a6', true);
select is((select count(*)::int from parcelas where plantation_id = 'b2300000-0000-0000-0000-000000000010'),
  0, 'técnico inactivo: no lee las parcelas');

-- ── Escritura por membresía ──────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a6', true);
select throws_ok(
  $$ insert into parcelas (plantation_id, nombre, codigo)
     values ('b2300000-0000-0000-0000-000000000010', 'P23x', 'P23x') $$,
  '42501', null, 'técnico inactivo: no inserta parcelas');
select is(
  (select sync_subgroup((select grupo from payload_23), '[]'::jsonb)->>'error'),
  'PERMISSION', 'técnico inactivo: sync_subgroup responde PERMISSION');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a5', true);
select lives_ok(
  $$ insert into parcelas (plantation_id, nombre, codigo)
     values ('b2300000-0000-0000-0000-000000000010', 'P23y', 'P23y') $$,
  'técnico activo: inserta parcelas');
select is(
  (select (sync_subgroup((select grupo from payload_23), '[]'::jsonb)->>'success')::boolean),
  true, 'técnico activo: sync_subgroup sube el grupo');

-- ── plantations ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a2', true);
select throws_ok(
  $$ insert into plantations (organizacion_id, lugar, periodo, creado_por)
     values ('b2300000-0000-0000-0000-000000000001', 'Inactivo 23', '2026',
             'b2300000-0000-0000-0000-0000000000a2') $$,
  '42501', null, 'admin inactivo: no crea plantaciones');
update plantations set lugar = 'Editada por inactivo'
  where id = 'b2300000-0000-0000-0000-000000000010';
select is((select lugar from plantations where id = 'b2300000-0000-0000-0000-000000000010'),
  'Plantación 23', 'admin inactivo: no edita plantaciones');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a1', true);
select lives_ok(
  $$ insert into plantations (organizacion_id, lugar, periodo, creado_por)
     values ('b2300000-0000-0000-0000-000000000001', 'Activo 23', '2026',
             'b2300000-0000-0000-0000-0000000000a1') $$,
  'admin activo: crea plantaciones');
update plantations set lugar = 'Editada por activo'
  where id = 'b2300000-0000-0000-0000-000000000010';
select is((select lugar from plantations where id = 'b2300000-0000-0000-0000-000000000010'),
  'Editada por activo', 'admin activo: edita plantaciones');

-- ── plantation_species ───────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a2', true);
select throws_ok(
  $$ insert into plantation_species (plantation_id, species_id)
     values ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-000000000021') $$,
  '42501', null, 'admin inactivo: no agrega especies a la plantación');
update plantation_species set orden_visual = 9
  where plantation_id = 'b2300000-0000-0000-0000-000000000010';
delete from plantation_species where plantation_id = 'b2300000-0000-0000-0000-000000000010';
select is(
  (select orden_visual from plantation_species
    where plantation_id = 'b2300000-0000-0000-0000-000000000010'
      and species_id = 'b2300000-0000-0000-0000-000000000020'),
  0, 'admin inactivo: no edita ni quita especies de la plantación');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a1', true);
select lives_ok(
  $$ insert into plantation_species (plantation_id, species_id)
     values ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-000000000021') $$,
  'admin activo: agrega especies a la plantación');
update plantation_species set orden_visual = 9
  where plantation_id = 'b2300000-0000-0000-0000-000000000010'
    and species_id = 'b2300000-0000-0000-0000-000000000020';
select is(
  (select orden_visual from plantation_species
    where plantation_id = 'b2300000-0000-0000-0000-000000000010'
      and species_id = 'b2300000-0000-0000-0000-000000000020'),
  9, 'admin activo: edita especies de la plantación');
delete from plantation_species
  where plantation_id = 'b2300000-0000-0000-0000-000000000010'
    and species_id = 'b2300000-0000-0000-0000-000000000021';
select is(
  (select count(*)::int from plantation_species
    where plantation_id = 'b2300000-0000-0000-0000-000000000010'),
  1, 'admin activo: quita especies de la plantación');

-- ── plantation_users ─────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a2', true);
select throws_ok(
  $$ insert into plantation_users (plantation_id, user_id)
     values ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-0000000000a7') $$,
  '42501', null, 'admin inactivo: no asigna usuarios');
delete from plantation_users
  where plantation_id = 'b2300000-0000-0000-0000-000000000010'
    and user_id = 'b2300000-0000-0000-0000-0000000000a5';
select is(
  (select count(*)::int from plantation_users
    where plantation_id = 'b2300000-0000-0000-0000-000000000010'
      and user_id = 'b2300000-0000-0000-0000-0000000000a5'),
  1, 'admin inactivo: no desasigna usuarios');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a1', true);
select lives_ok(
  $$ insert into plantation_users (plantation_id, user_id)
     values ('b2300000-0000-0000-0000-000000000010', 'b2300000-0000-0000-0000-0000000000a7') $$,
  'admin activo: asigna usuarios');
delete from plantation_users
  where plantation_id = 'b2300000-0000-0000-0000-000000000010'
    and user_id = 'b2300000-0000-0000-0000-0000000000a7';
select is(
  (select count(*)::int from plantation_users
    where plantation_id = 'b2300000-0000-0000-0000-000000000010'
      and user_id = 'b2300000-0000-0000-0000-0000000000a7'),
  0, 'admin activo: desasigna usuarios');

-- ── species ──────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a4', true);
select throws_ok(
  $$ insert into species (codigo, nombre) values ('SP23x', 'Inactivo 23') $$,
  '42501', null, 'superadmin inactivo: no crea especies');
update species set nombre = 'Editada por inactivo'
  where id = 'b2300000-0000-0000-0000-000000000020';
select is((select nombre from species where id = 'b2300000-0000-0000-0000-000000000020'),
  'Especie 23', 'superadmin inactivo: no edita especies');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a3', true);
select lives_ok(
  $$ insert into species (codigo, nombre) values ('SP23y', 'Activo 23') $$,
  'superadmin activo: crea especies');
update species set nombre = 'Editada por activo'
  where id = 'b2300000-0000-0000-0000-000000000020';
select is((select nombre from species where id = 'b2300000-0000-0000-0000-000000000020'),
  'Editada por activo', 'superadmin activo: edita especies');

-- ── profiles ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a4', true);
update profiles set nombre = 'Editado por inactivo'
  where id = 'b2300000-0000-0000-0000-0000000000a7';
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a3', true);
select is((select nombre from profiles where id = 'b2300000-0000-0000-0000-0000000000a7'),
  'sin-membresia-23', 'superadmin inactivo: no edita perfiles ajenos');

update profiles set nombre = 'Editado por activo'
  where id = 'b2300000-0000-0000-0000-0000000000a7';
select is((select nombre from profiles where id = 'b2300000-0000-0000-0000-0000000000a7'),
  'Editado por activo', 'superadmin activo: edita perfiles ajenos');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a1', true);
update profiles set nombre = 'Editado por admin'
  where id = 'b2300000-0000-0000-0000-0000000000a7';
select is((select nombre from profiles where id = 'b2300000-0000-0000-0000-0000000000a7'),
  'Editado por activo', 'admin activo: no edita perfiles ajenos');

-- ── Storage ──────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a6', true);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2300000-0000-0000-0000-000000000010/parcelas/x/trees/i.jpg') $$,
  '42501', null, 'técnico inactivo: no sube fotos');

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a5', true);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('tree-photos', 'plantations/b2300000-0000-0000-0000-000000000010/parcelas/x/trees/a.jpg') $$,
  'técnico activo: sube fotos');

-- ── Reactivación ─────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claim.sub', '', true);
update profiles set activo = true where id = 'b2300000-0000-0000-0000-0000000000a6';
set local role authenticated;

select set_config('request.jwt.claim.sub', 'b2300000-0000-0000-0000-0000000000a6', true);
select is(is_plantation_member('b2300000-0000-0000-0000-000000000010'), true,
  'técnico reactivado: recupera la membresía sin reasignarlo');
select is((select count(*)::int from parcelas where plantation_id = 'b2300000-0000-0000-0000-000000000010'),
  2, 'técnico reactivado: vuelve a leer las parcelas');

select * from finish();
rollback;
