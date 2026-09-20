-- Un perfil inactivo no ve su organización ni se edita a sí mismo (050, #532).
-- La regresión que más importa es la última: tiene que SEGUIR leyendo su propia
-- fila, que es por donde la web y la app detectan que la cuenta está de baja.
begin;
select plan(10);

insert into organizations (id, nombre) values
  ('b2800000-0000-0000-0000-000000000001', 'Org Test 28');

insert into auth.users (id, email) values
  ('b2800000-0000-0000-0000-0000000000a1', 'tecnico-28@test.local'),
  ('b2800000-0000-0000-0000-0000000000a2', 'inactivo-28@test.local');

update profiles set nombre = 'Compañero', organizacion_id = 'b2800000-0000-0000-0000-000000000001'
  where id = 'b2800000-0000-0000-0000-0000000000a1';
update profiles set nombre = 'Dado de baja', organizacion_id = 'b2800000-0000-0000-0000-000000000001'
  where id = 'b2800000-0000-0000-0000-0000000000a2';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2800000-0000-0000-0000-0000000000a2', true);

-- Todavía activo: la línea de base de lo que se le quita al desactivarlo.
select is(current_organizacion_id(), 'b2800000-0000-0000-0000-000000000001'::uuid,
  'activo: el helper devuelve su organización');
select is((select count(*)::int from profiles where id = 'b2800000-0000-0000-0000-0000000000a1'),
  1, 'activo: lee el perfil de otro de su organización');
select is((select count(*)::int from organizations where id = 'b2800000-0000-0000-0000-000000000001'),
  1, 'activo: lee su organización');

update profiles set nombre = 'Nombre elegido' where id = 'b2800000-0000-0000-0000-0000000000a2';
select is((select nombre from profiles where id = 'b2800000-0000-0000-0000-0000000000a2'),
  'Nombre elegido', 'activo: puede cambiar su propio nombre');

-- Baja hecha como la edge function: sin claim, que es lo único que
-- `protect_profile_fields` deja cambiar `activo`.
reset role;
select set_config('request.jwt.claim.sub', '', true);
update profiles set activo = false where id = 'b2800000-0000-0000-0000-0000000000a2';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2800000-0000-0000-0000-0000000000a2', true);

select is(current_organizacion_id(), null,
  'inactivo: el helper no devuelve organización');
select is((select count(*)::int from profiles where id = 'b2800000-0000-0000-0000-0000000000a1'),
  0, 'inactivo: no lee los perfiles de su organización');
select is((select count(*)::int from organizations where id = 'b2800000-0000-0000-0000-000000000001'),
  0, 'inactivo: no lee su organización');

-- RLS no levanta excepción en un UPDATE que no matchea: no cambia nada y listo.
update profiles set nombre = 'Nombre de un baneado' where id = 'b2800000-0000-0000-0000-0000000000a2';
select is((select nombre from profiles where id = 'b2800000-0000-0000-0000-0000000000a2'),
  'Nombre elegido', 'inactivo: no puede cambiar su propio nombre');

select is((select count(*)::int from profiles where id = 'b2800000-0000-0000-0000-0000000000a2'),
  1, 'inactivo: SIGUE leyendo su propio perfil, que es como se entera de la baja');

reset role;
select set_config('request.jwt.claim.sub', '', true);
update profiles set activo = true where id = 'b2800000-0000-0000-0000-0000000000a2';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2800000-0000-0000-0000-0000000000a2', true);

select is(current_organizacion_id(), 'b2800000-0000-0000-0000-000000000001'::uuid,
  'reactivado: recupera su organización');

select * from finish();
rollback;
