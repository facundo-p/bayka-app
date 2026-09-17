-- is_admin() exige perfil activo (043, #506). La policy representativa es el
-- SELECT de plantations (034): sin membresía, solo is_admin() da acceso.
begin;
select plan(7);

insert into organizations (id, nombre) values
  ('b2000000-0000-0000-0000-000000000001', 'Org Test 20');

insert into auth.users (id, email) values
  ('b2000000-0000-0000-0000-0000000000a1', 'admin-20@test.local'),
  ('b2000000-0000-0000-0000-0000000000a2', 'admin-inactivo-20@test.local'),
  ('b2000000-0000-0000-0000-0000000000a3', 'super-inactivo-20@test.local');

update profiles set rol = 'admin', organizacion_id = 'b2000000-0000-0000-0000-000000000001'
  where id = 'b2000000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', activo = false,
  organizacion_id = 'b2000000-0000-0000-0000-000000000001'
  where id = 'b2000000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin', activo = false,
  organizacion_id = 'b2000000-0000-0000-0000-000000000001'
  where id = 'b2000000-0000-0000-0000-0000000000a3';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('b2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001',
   'Plantación 20', '2026', 'b2000000-0000-0000-0000-0000000000a1');

-- trg_add_admin_memberships sumó al admin activo. Sin membresías, el acceso
-- depende solo de is_admin().
delete from plantation_users where plantation_id = 'b2000000-0000-0000-0000-000000000002';

set local role authenticated;

select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-0000000000a1', true);
select is(is_admin(), true, 'admin activo: pasa is_admin()');
select is((select count(*)::int from plantations where id = 'b2000000-0000-0000-0000-000000000002'),
  1, 'admin activo: lee la plantación de su organización sin ser miembro');

select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-0000000000a2', true);
select is(is_admin(), false, 'admin inactivo: no pasa is_admin()');
select is((select count(*)::int from plantations where id = 'b2000000-0000-0000-0000-000000000002'),
  0, 'admin inactivo: no lee la plantación de su organización');

select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-0000000000a3', true);
select is(is_admin(), false, 'superadmin inactivo: no pasa is_admin()');
select is((select count(*)::int from plantations where id = 'b2000000-0000-0000-0000-000000000002'),
  0, 'superadmin inactivo: no lee la plantación de su organización');

-- Reactivarlo le devuelve el acceso. Sin claim, como la edge function: el
-- guard de profiles rechaza cambios de activo hechos por un usuario.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update profiles set activo = true where id = 'b2000000-0000-0000-0000-0000000000a2';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2000000-0000-0000-0000-0000000000a2', true);
select is(is_admin(), true, 'admin reactivado: vuelve a pasar is_admin()');

select * from finish();
rollback;
