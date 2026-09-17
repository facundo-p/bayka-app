-- Asignaciones de técnicos (#522): exigen plantación existente y no archivada.
-- Una finalizada las admite.
begin;
select plan(15);

insert into organizations (id, nombre) values
  ('b2500000-0000-0000-0000-000000000001', 'Org Test 25');

insert into auth.users (id, email) values
  ('b2500000-0000-0000-0000-0000000000a1', 'tecnico-25@test.local'),
  ('b2500000-0000-0000-0000-0000000000a2', 'admin-25@test.local'),
  ('b2500000-0000-0000-0000-0000000000a3', 'superadmin-25@test.local'),
  ('b2500000-0000-0000-0000-0000000000a4', 'tecnico-nuevo-25@test.local');

update profiles set organizacion_id = 'b2500000-0000-0000-0000-000000000001'
  where id in ('b2500000-0000-0000-0000-0000000000a1', 'b2500000-0000-0000-0000-0000000000a4');
update profiles set rol = 'admin', organizacion_id = 'b2500000-0000-0000-0000-000000000001'
  where id = 'b2500000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin', organizacion_id = 'b2500000-0000-0000-0000-000000000001'
  where id = 'b2500000-0000-0000-0000-0000000000a3';

-- 10: activa. 20: finalizada. 30: archivada. Los triggers suman a admin y superadmin.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, archivada_en) values
  ('b2500000-0000-0000-0000-000000000010', 'b2500000-0000-0000-0000-000000000001',
   'Activa 25', '2026', 'b2500000-0000-0000-0000-0000000000a2', 'activa', null),
  ('b2500000-0000-0000-0000-000000000020', 'b2500000-0000-0000-0000-000000000001',
   'Finalizada 25', '2026', 'b2500000-0000-0000-0000-0000000000a2', 'finalizada', null),
  ('b2500000-0000-0000-0000-000000000030', 'b2500000-0000-0000-0000-000000000001',
   'Archivada 25', '2026', 'b2500000-0000-0000-0000-0000000000a2', 'activa', now());

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b2500000-0000-0000-0000-000000000010', 'b2500000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b2500000-0000-0000-0000-000000000020', 'b2500000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b2500000-0000-0000-0000-000000000030', 'b2500000-0000-0000-0000-0000000000a1', 'tecnico');

set local role authenticated;

-- ── Admin: INSERT ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2500000-0000-0000-0000-0000000000a2', true);

select lives_ok(
  $$insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
    values ('b2500000-0000-0000-0000-000000000010', 'b2500000-0000-0000-0000-0000000000a4', 'tecnico')$$,
  'admin asigna en una activa');

select lives_ok(
  $$insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
    values ('b2500000-0000-0000-0000-000000000020', 'b2500000-0000-0000-0000-0000000000a4', 'tecnico')$$,
  'admin asigna en una finalizada');

select throws_ok(
  $$insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
    values ('b2500000-0000-0000-0000-000000000030', 'b2500000-0000-0000-0000-0000000000a4', 'tecnico')$$,
  '42501', null, 'admin no asigna en una archivada');

select throws_ok(
  $$insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
    values ('b2500000-0000-0000-0000-0000000000ff', 'b2500000-0000-0000-0000-0000000000a4', 'tecnico')$$,
  '42501', null, 'una plantación inexistente falla por RLS, no por FK');

-- ── Admin: DELETE ───────────────────────────────────────────────────────────
delete from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000030'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1';
delete from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000020'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1';
delete from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000010'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1';

reset role;
select is((select count(*)::int from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000030'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1'), 1,
  'admin no quita técnicos de una archivada');
select is((select count(*)::int from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000020'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1'), 0,
  'admin quita técnicos de una finalizada');
select is((select count(*)::int from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000010'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1'), 0,
  'admin quita técnicos de una activa');
set local role authenticated;

-- ── Superadmin: la archivada tampoco ────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2500000-0000-0000-0000-0000000000a3', true);

select throws_ok(
  $$insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
    values ('b2500000-0000-0000-0000-000000000030', 'b2500000-0000-0000-0000-0000000000a4', 'tecnico')$$,
  '42501', null, 'superadmin no asigna en una archivada');

delete from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000030'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1';

reset role;
select is((select count(*)::int from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000030'
    and user_id = 'b2500000-0000-0000-0000-0000000000a1'), 1,
  'superadmin no quita técnicos de una archivada');
set local role authenticated;

-- ── Técnico: sigue sin poder asignar ────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2500000-0000-0000-0000-0000000000a1', true);

select throws_ok(
  $$insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
    values ('b2500000-0000-0000-0000-000000000010', 'b2500000-0000-0000-0000-0000000000a1', 'admin')$$,
  '42501', null, 'tecnico no se asigna a sí mismo');

-- ── Helper ──────────────────────────────────────────────────────────────────
select is(plantacion_admite_asignaciones('b2500000-0000-0000-0000-000000000010'), true, 'activa admite');
select is(plantacion_admite_asignaciones('b2500000-0000-0000-0000-000000000020'), true, 'finalizada admite');
select is(plantacion_admite_asignaciones('b2500000-0000-0000-0000-000000000030'), false, 'archivada no admite');

reset role;
select is(has_function_privilege('anon', 'public.plantacion_admite_asignaciones(uuid)', 'execute'), false,
  'anon no ejecuta el helper');

-- Sin cambios para los triggers: archivar no impide que un admin nuevo sea miembro.
select set_config('request.jwt.claim.sub', 'b2500000-0000-0000-0000-0000000000a3', true);
update profiles set rol = 'admin' where id = 'b2500000-0000-0000-0000-0000000000a4';
select is((select count(*)::int from plantation_users
  where plantation_id = 'b2500000-0000-0000-0000-000000000030'
    and user_id = 'b2500000-0000-0000-0000-0000000000a4'), 1,
  'el trigger de membresía admin sigue escribiendo en una archivada');

select * from finish();
rollback;
