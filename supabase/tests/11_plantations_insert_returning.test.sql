-- plantations INSERT … RETURNING bajo RLS (#379): con RETURNING, Postgres
-- valida la fila nueva contra la policy SELECT antes de que el trigger AFTER
-- INSERT sume al creador como miembro. Sin RETURNING no hay chequeo SELECT y
-- el bug no se ve, por eso los inserts acá lo usan (PostgREST hace lo mismo
-- con `.select()`).
begin;
select plan(6);

-- org1 usa el UUID hardcodeado que handle_new_user asigna por default.
insert into organizations (id, nombre) values
  ('00000000-0000-0000-0000-000000000001', 'Org1 Test 11'),
  ('11000000-0000-0000-0000-000000000002', 'Org2 Test 11');

insert into auth.users (id, email) values
  ('11000000-0000-0000-0000-0000000000a1', 'admin-11@test.local'),
  ('11000000-0000-0000-0000-0000000000a2', 'superadmin-11@test.local'),
  ('11000000-0000-0000-0000-0000000000a3', 'tecnico-11@test.local'),
  ('11000000-0000-0000-0000-0000000000a4', 'admin-org2-11@test.local');

update profiles set rol = 'admin' where id = '11000000-0000-0000-0000-0000000000a1';
update profiles set rol = 'superadmin' where id = '11000000-0000-0000-0000-0000000000a2';
update profiles set rol = 'admin', organizacion_id = '11000000-0000-0000-0000-000000000002'
  where id = '11000000-0000-0000-0000-0000000000a4';

-- Plantación preexistente de org1 sin membresía del técnico.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('11000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'Existente org1', '2026', '11000000-0000-0000-0000-0000000000a1');

set local role authenticated;

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-0000000000a1', true);
select lives_ok(
  $$ insert into plantations (id, organizacion_id, lugar, periodo, creado_por)
     values ('11000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
             'Nueva admin', '2026', '11000000-0000-0000-0000-0000000000a1')
     returning id $$,
  'un admin crea una plantación de su organización con RETURNING'
);
select is((select count(*)::int from plantations where id = '11000000-0000-0000-0000-000000000011'),
  1, 'el admin ve la plantación que acaba de crear');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-0000000000a2', true);
select lives_ok(
  $$ insert into plantations (id, organizacion_id, lugar, periodo, creado_por)
     values ('11000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
             'Nueva superadmin', '2026', '11000000-0000-0000-0000-0000000000a2')
     returning id $$,
  'un superadmin crea una plantación de su organización con RETURNING'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-0000000000a3', true);
select throws_ok(
  $$ insert into plantations (id, organizacion_id, lugar, periodo, creado_por)
     values ('11000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001',
             'Nueva tecnico', '2026', '11000000-0000-0000-0000-0000000000a3')
     returning id $$,
  '42501'::character(5),
  'new row violates row-level security policy for table "plantations"',
  'un técnico sigue sin poder crear plantaciones'
);
select is((select count(*)::int from plantations where id = '11000000-0000-0000-0000-000000000010'),
  0, 'un técnico no ve plantaciones de su organización de las que no es miembro');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-0000000000a4', true);
select is((select count(*)::int from plantations
            where organizacion_id = '00000000-0000-0000-0000-000000000001'),
  0, 'un admin de otra organización no ve plantaciones de org1');

select * from finish();
rollback;
