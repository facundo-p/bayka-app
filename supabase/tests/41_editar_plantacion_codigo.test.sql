-- editar_plantacion con el código de plantación (062, #559): lo aplica con la
-- plantación activa, rechaza uno repetido en la organización sin aplicar nada,
-- valida el formato, detecta conflictos y no lo cambia en una finalizada aunque
-- el superadmin sí pueda editar sus otros campos.
begin;
select plan(14);

insert into organizations (id, nombre) values
  ('b4100000-0000-0000-0000-000000000001', 'Org Test 41'),
  ('b4100000-0000-0000-0000-000000000009', 'Otra Org 41');

insert into auth.users (id, email) values
  ('b4100000-0000-0000-0000-0000000000a1', 'admin-41@test.local'),
  ('b4100000-0000-0000-0000-0000000000a4', 'super-41@test.local'),
  ('b4100000-0000-0000-0000-0000000000a9', 'admin-otra-41@test.local');

update profiles set rol = 'admin', nombre = 'Admin 41', organizacion_id = 'b4100000-0000-0000-0000-000000000001'
  where id = 'b4100000-0000-0000-0000-0000000000a1';
update profiles set rol = 'superadmin', organizacion_id = 'b4100000-0000-0000-0000-000000000001'
  where id = 'b4100000-0000-0000-0000-0000000000a4';
update profiles set rol = 'admin', organizacion_id = 'b4100000-0000-0000-0000-000000000009'
  where id = 'b4100000-0000-0000-0000-0000000000a9';

select tests.crear_plantacion('b4100000-0000-0000-0000-000000000010', 'b4100000-0000-0000-0000-000000000001',
  'b4100000-0000-0000-0000-0000000000a1', 'Activa 41', p_codigo => 'AC41');
select tests.crear_plantacion('b4100000-0000-0000-0000-000000000011', 'b4100000-0000-0000-0000-000000000001',
  'b4100000-0000-0000-0000-0000000000a1', 'Otra activa 41', p_codigo => 'OT41');
select tests.crear_plantacion('b4100000-0000-0000-0000-000000000012', 'b4100000-0000-0000-0000-000000000001',
  'b4100000-0000-0000-0000-0000000000a1', 'Finalizada 41', p_estado => 'finalizada', p_codigo => 'FI41');
select tests.crear_plantacion('b4100000-0000-0000-0000-000000000019', 'b4100000-0000-0000-0000-000000000009',
  'b4100000-0000-0000-0000-0000000000a9', 'De otra org 41', p_codigo => 'AJ41');

create temp view plantacion_41 as
  select lugar, codigo, ultima_edicion from plantations where id = 'b4100000-0000-0000-0000-000000000010';
grant select on plantacion_41 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4100000-0000-0000-0000-0000000000a1', true);

select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000010', '{"codigo": "AC41-B"}', '{"codigo": "AC41"}'),
  '{"success": true}'::jsonb, 'cambia el código de una activa');
select is((select codigo from plantacion_41), 'AC41-B', 'el código quedó guardado');
select is(
  (select ultima_edicion -> 'codigo' ->> 'por' from plantacion_41),
  'b4100000-0000-0000-0000-0000000000a1', 'y la auditoría registra quién lo cambió');

select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000010',
    '{"codigo": "OT41", "lugar": "Activa 41 bis"}', '{"codigo": "AC41-B", "lugar": "Activa 41"}'),
  '{"success": false, "error": "CODIGO_DUPLICADO"}'::jsonb,
  'un código de otra plantación de la organización se rechaza');
select is((select lugar from plantacion_41), 'Activa 41', 'sin aplicar ningún campo');

select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000010', '{"codigo": "AJ41"}', '{"codigo": "AC41-B"}'),
  '{"success": true}'::jsonb, 'el de una plantación de otra organización se permite');

select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000010', '{"codigo": "aj41"}', '{"codigo": "AJ41"}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "codigo"}'::jsonb, 'minúsculas se rechazan');
select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000010', '{"codigo": "AJ41-"}', '{"codigo": "AJ41"}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "codigo"}'::jsonb, 'un guion al final se rechaza');
select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000010', '{"codigo": null}', '{"codigo": "AJ41"}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "codigo"}'::jsonb, 'vaciarlo se rechaza');

select is(
  (select c - 'editado_en' from jsonb_array_elements(
    editar_plantacion('b4100000-0000-0000-0000-000000000010', '{"codigo": "NU41"}', '{"codigo": "AC41"}')
      -> 'conflictos') c),
  '{"campo": "codigo", "valor_servidor": "AJ41", "editado_por": "Admin 41"}'::jsonb,
  'si otro lo cambió desde que se editó, vuelve como conflicto');
select is((select codigo from plantacion_41), 'AJ41', 'y no se aplica');

select set_config('request.jwt.claim.sub', 'b4100000-0000-0000-0000-0000000000a4', true);
select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000012', '{"codigo": "FI41-B"}', '{"codigo": "FI41"}'),
  '{"success": false, "error": "PLANTACION_FINALIZADA"}'::jsonb,
  'un superadmin no cambia el código de una finalizada');
select is(
  editar_plantacion('b4100000-0000-0000-0000-000000000012', '{"lugar": "Finalizada 41 bis"}', '{"lugar": "Finalizada 41"}'),
  '{"success": true}'::jsonb, 'pero sigue editando sus otros campos');

reset role;
select is(
  (select codigo from plantations where id = 'b4100000-0000-0000-0000-000000000012'),
  'FI41', 'el código de la finalizada no cambió');

select * from finish();
rollback;
