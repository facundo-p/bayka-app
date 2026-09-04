-- plantations DELETE (031, #300): solo admin/superadmin; para el resto la fila
-- queda silenciosamente filtrada por RLS (semántica de DELETE, no un error).
begin;
select plan(6);

insert into organizations (id, nombre) values
  ('f0000000-0000-0000-0000-000000000001', 'Org Test 08');

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-0000000000a1', 'admin-08@test.local'),
  ('f0000000-0000-0000-0000-0000000000a2', 'tecnico-08@test.local');
update profiles set rol = 'admin' where id = 'f0000000-0000-0000-0000-0000000000a1';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
   'Lugar Test 08', '2026', 'f0000000-0000-0000-0000-0000000000a1');
-- trg_add_admin_memberships ya sumó al admin como miembro.

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-0000000000a2', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('f0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002',
   'Parcela 08', 'P08');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('f0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000003', 'G08', 'G08', 'linea',
   'f0000000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('f0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000004',
   1, 'A1', 'f0000000-0000-0000-0000-0000000000a1');

set local role authenticated;

-- Tecnico (miembro, no admin): la policy no matchea, RLS filtra la fila.
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000a2', true);

select lives_ok(
  $$ delete from plantations where id = 'f0000000-0000-0000-0000-000000000002' $$,
  'el delete del tecnico no lanza excepción (RLS filtra, no rechaza)'
);

select is(
  ( select count(*)::int from plantations where id = 'f0000000-0000-0000-0000-000000000002' ),
  1,
  'la plantación sigue existiendo: el tecnico no pudo borrarla'
);

-- Admin: borra y el cascade se lleva plantation_users/parcelas.
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-0000000000a1', true);

select lives_ok(
  $$ delete from plantations where id = 'f0000000-0000-0000-0000-000000000002' $$,
  'un admin puede borrar la plantación'
);

select is(
  ( select count(*)::int from plantations where id = 'f0000000-0000-0000-0000-000000000002' ),
  0,
  'la plantación quedó borrada'
);

reset role;

select is(
  ( select count(*)::int from plantation_users where plantation_id = 'f0000000-0000-0000-0000-000000000002' )
  + ( select count(*)::int from parcelas where plantation_id = 'f0000000-0000-0000-0000-000000000002' ),
  0,
  'el cascade se llevó plantation_users y parcelas de la plantación borrada'
);

select is(
  ( select count(*)::int from groups where plantation_id = 'f0000000-0000-0000-0000-000000000002' )
  + ( select count(*)::int from trees where group_id = 'f0000000-0000-0000-0000-000000000004' ),
  0,
  'el cascade se llevó groups y trees de la plantación borrada'
);

select * from finish();
rollback;
