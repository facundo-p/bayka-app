-- Un INSERT en auth.users no da organización (060, #607): la asigna admin-users
-- en el alta. Sin ella el perfil no lee nada de la organización del cliente.
begin;
select plan(12);

-- La organización del MVP, que el trigger asignaba a todo usuario nuevo.
insert into organizations (id, nombre) values
  ('00000000-0000-0000-0000-000000000001', 'Org MVP Test 38');

insert into auth.users (id, email) values
  ('38000000-0000-0000-0000-0000000000a1', 'miembro-38@test.local');
update profiles set organizacion_id = '00000000-0000-0000-0000-000000000001'
  where id = '38000000-0000-0000-0000-0000000000a1';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('38000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'Plantación Test 38', '2026', '38000000-0000-0000-0000-0000000000a1');

-- Como un signUp: la metadata la controla el cliente.
insert into auth.users (id, email, raw_user_meta_data) values
  ('38000000-0000-0000-0000-0000000000b1', 'intruso-38@test.local',
   '{"nombre": "Intruso", "rol": "superadmin", "organizacion_id": "00000000-0000-0000-0000-000000000001"}');

select is((select organizacion_id from profiles where id = '38000000-0000-0000-0000-0000000000b1'),
  null, 'el profile nace sin organización aunque la metadata traiga una');
select is((select rol from profiles where id = '38000000-0000-0000-0000-0000000000b1'),
  'tecnico', 'el rol sigue siendo tecnico aunque la metadata pida otro');
select is((select nombre from profiles where id = '38000000-0000-0000-0000-0000000000b1'),
  'Intruso', 'el nombre sí sale de la metadata');

set local role authenticated;
select set_config('request.jwt.claim.sub', '38000000-0000-0000-0000-0000000000b1', true);

select is(current_organizacion_id(), null, 'sin organización: el helper devuelve null');
select is((select count(*)::int from profiles where id = '38000000-0000-0000-0000-0000000000a1'),
  0, 'sin organización: no lee perfiles de la organización');
select is((select count(*)::int from organizations), 0, 'sin organización: no lee organizaciones');
select is((select count(*)::int from plantations), 0, 'sin organización: no lee plantaciones');
select is((select count(*)::int from profiles where id = '38000000-0000-0000-0000-0000000000b1'),
  1, 'sin organización: lee su propio perfil, que es como la web y la app muestran sin-acceso');

-- El alta administrada: admin-users asigna la organización con service_role.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update profiles set organizacion_id = '00000000-0000-0000-0000-000000000001'
  where id = '38000000-0000-0000-0000-0000000000b1';
set local role authenticated;
select set_config('request.jwt.claim.sub', '38000000-0000-0000-0000-0000000000b1', true);

select is(current_organizacion_id(), '00000000-0000-0000-0000-000000000001'::uuid,
  'con la organización asignada, el helper la devuelve');
select is((select count(*)::int from profiles where id = '38000000-0000-0000-0000-0000000000a1'),
  1, 'con la organización asignada, lee los perfiles de su organización');
select is((select count(*)::int from plantations), 0,
  'un técnico con organización sigue sin leer plantaciones de las que no es miembro');

-- Alta de un rol elevado: rol y organización en el mismo UPDATE, como admin-users.
reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into auth.users (id, email) values
  ('38000000-0000-0000-0000-0000000000c1', 'admin-38@test.local');
update profiles set rol = 'admin', organizacion_id = '00000000-0000-0000-0000-000000000001'
  where id = '38000000-0000-0000-0000-0000000000c1';

select is(
  (select rol_en_plantacion from plantation_users
    where user_id = '38000000-0000-0000-0000-0000000000c1'
      and plantation_id = '38000000-0000-0000-0000-000000000010'),
  'admin', 'rol y organización juntos: el admin nuevo queda en las plantaciones de su organización');

select * from finish();
rollback;
