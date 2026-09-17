-- profiles.eliminado_en (040, #479): solo la cambia service_role, un eliminado nunca
-- está activo y los triggers de membresía admin no lo suman a ninguna plantación.
begin;
select plan(11);

insert into organizations (id, nombre) values
  ('00000000-0000-0000-0000-000000000001', 'Org1 Test 19');

insert into auth.users (id, email) values
  ('19000000-0000-0000-0000-0000000000a1', 'super-19@test.local'),
  ('19000000-0000-0000-0000-0000000000b1', 'tecnico-19@test.local'),
  ('19000000-0000-0000-0000-0000000000c1', 'admin-19@test.local');

update profiles set rol = 'superadmin' where id = '19000000-0000-0000-0000-0000000000a1';

select has_column('public', 'profiles', 'eliminado_en', 'profiles tiene eliminado_en');

-- ── Usuarios autenticados: no tocan eliminado_en ───────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', true);

select throws_ok(
  $$ update profiles set eliminado_en = now()
     where id = '19000000-0000-0000-0000-0000000000b1' $$,
  'P0001',
  'El email y el estado de un usuario solo se cambian desde la gestión de usuarios',
  'un superadmin no marca eliminado_en directo desde la API'
);
select lives_ok(
  $$ update profiles set nombre = 'Técnico renombrado'
     where id = '19000000-0000-0000-0000-0000000000b1' $$,
  'un superadmin sí cambia el nombre (control)'
);

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', true);
select throws_ok(
  $$ update profiles set eliminado_en = now()
     where id = '19000000-0000-0000-0000-0000000000b1' $$,
  'P0001',
  'El email y el estado de un usuario solo se cambian desde la gestión de usuarios',
  'un usuario no marca su propio eliminado_en'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

-- ── service_role: marca eliminado ───────────────────────────────────────────
select lives_ok(
  $$ update profiles set activo = false, eliminado_en = now()
     where id in ('19000000-0000-0000-0000-0000000000b1', '19000000-0000-0000-0000-0000000000c1') $$,
  'service_role marca eliminado (activo = false + eliminado_en)'
);

select throws_ok(
  $$ update profiles set activo = true
     where id = '19000000-0000-0000-0000-0000000000b1' $$,
  '23514',
  null,
  'un eliminado no se puede reactivar'
);
select throws_ok(
  $$ update profiles set eliminado_en = now()
     where id = '19000000-0000-0000-0000-0000000000a1' $$,
  '23514',
  null,
  'no se marca eliminado a un usuario activo'
);

-- Eliminado desde auth: la sesión no se puede usar para quitarle la marca.
set local role authenticated;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', true);
select throws_ok(
  $$ update profiles set eliminado_en = null
     where id = '19000000-0000-0000-0000-0000000000b1' $$,
  'P0001',
  'El email y el estado de un usuario solo se cambian desde la gestión de usuarios',
  'un superadmin no desmarca a un eliminado'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- ── Membresías: un eliminado no recibe ninguna ─────────────────────────────
update profiles set rol = 'admin' where id = '19000000-0000-0000-0000-0000000000c1';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('19000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'P1 Test 19', '2026', '19000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*)::int from plantation_users
    where plantation_id = '19000000-0000-0000-0000-000000000010'
      and user_id = '19000000-0000-0000-0000-0000000000c1'),
  0, 'una plantación nueva no suma como miembro al admin eliminado'
);
select is(
  (select count(*)::int from plantation_users
    where plantation_id = '19000000-0000-0000-0000-000000000010'
      and user_id = '19000000-0000-0000-0000-0000000000a1'),
  1, 'el superadmin activo sí queda miembro (control)'
);

update profiles set rol = 'superadmin' where id = '19000000-0000-0000-0000-0000000000c1';
select is(
  (select count(*)::int from plantation_users where user_id = '19000000-0000-0000-0000-0000000000c1'),
  0, 'cambiarle el rol a un eliminado no le da membresías'
);

select * from finish();
rollback;
