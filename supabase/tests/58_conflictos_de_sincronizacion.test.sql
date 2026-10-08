-- Conflictos de sincronización (075, #802). `sync_subgroup` conserva el GPS, la
-- foto, la especie y los datos del grupo del servidor si difieren de la base que
-- manda el móvil, y los devuelve en `conservados`. Sin base pisa como antes; con
-- la base igual al servidor (conservar la mía) pisa. La foto que pierde y la
-- reemplazada quedan anotadas para el cron, y el SubID sigue al código de grupo
-- que conserva el servidor.
begin;
select plan(39);

insert into organizations (id, nombre) values ('b5800000-0000-0000-0000-000000000001', 'Org Test 58');

insert into auth.users (id, email) values
  ('b5800000-0000-0000-0000-0000000000a1', 'admin-58@test.local'),
  ('b5800000-0000-0000-0000-0000000000a2', 'tecnico-58@test.local'),
  ('b5800000-0000-0000-0000-0000000000a3', 'otro-58@test.local');

update profiles set organizacion_id = 'b5800000-0000-0000-0000-000000000001'
  where id in ('b5800000-0000-0000-0000-0000000000a2', 'b5800000-0000-0000-0000-0000000000a3');
update profiles set rol = 'admin', organizacion_id = 'b5800000-0000-0000-0000-000000000001'
  where id = 'b5800000-0000-0000-0000-0000000000a1';

select tests.crear_plantacion('b5800000-0000-0000-0000-000000000002', 'b5800000-0000-0000-0000-000000000001',
  'b5800000-0000-0000-0000-0000000000a1', 'Conflictos 58');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b5800000-0000-0000-0000-000000000002', 'b5800000-0000-0000-0000-0000000000a1', 'admin'),
  ('b5800000-0000-0000-0000-000000000002', 'b5800000-0000-0000-0000-0000000000a2', 'tecnico'),
  ('b5800000-0000-0000-0000-000000000002', 'b5800000-0000-0000-0000-0000000000a3', 'tecnico')
on conflict (plantation_id, user_id) do nothing;

insert into species (id, codigo, nombre) values
  ('b5800000-0000-0000-0000-0000000000e1', 'T58A', 'Alamo 58'),
  ('b5800000-0000-0000-0000-0000000000e2', 'T58B', 'Ceibo 58'),
  ('b5800000-0000-0000-0000-0000000000e3', 'T58C', 'Tala 58');
insert into plantation_species (plantation_id, species_id, orden_visual)
select 'b5800000-0000-0000-0000-000000000002', id, 0 from species where codigo like 'T58%';

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5800000-0000-0000-0000-0000000000b1', 'b5800000-0000-0000-0000-000000000002', 'Norte', 'P1');
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b5800000-0000-0000-0000-0000000000c1', 'b5800000-0000-0000-0000-000000000002',
   'b5800000-0000-0000-0000-0000000000b1', 'Uno', 'L1', 'linea', 'activa', 'b5800000-0000-0000-0000-0000000000a2');

-- Path de la foto de un árbol, y punto GPS: O original, A del admin, T y N del técnico.
create function pg_temp.foto58(p_n int, p_version text) returns text language sql as $$
  select 'plantations/b5800000-0000-0000-0000-000000000002/parcelas/b5800000-0000-0000-0000-0000000000b1/trees/'
         || 'b5800000-0000-0000-0000-0000000000d' || p_n || coalesce('-' || p_version, '') || '.jpg';
$$;
create function pg_temp.punto58(p text) returns jsonb language sql as $$
  select case p
    when 'O' then '{"latitude": -34.1, "longitude": -58.1, "gps_accuracy": 5, "gps_captured_at": "2026-10-01T10:00:00+00:00"}'
    when 'A' then '{"latitude": -34.2, "longitude": -58.2, "gps_accuracy": 3, "gps_captured_at": "2026-10-02T10:00:00+00:00"}'
    when 'T' then '{"latitude": -34.3, "longitude": -58.3, "gps_accuracy": 4, "gps_captured_at": "2026-10-03T10:00:00+00:00"}'
    when 'N' then '{"latitude": -34.4, "longitude": -58.4, "gps_accuracy": 2, "gps_captured_at": "2026-10-04T10:00:00+00:00"}'
  end::jsonb;
$$;
-- Un árbol del payload: especie, foto y GPS sin cambios respecto de su base.
create function pg_temp.arbol58(p_n int, p_cambios jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', 'b5800000-0000-0000-0000-0000000000d' || p_n,
    'subgroup_id', 'b5800000-0000-0000-0000-0000000000c1',
    'posicion', p_n, 'sub_id', 'P1L1T58A' || p_n,
    'species_id', 'b5800000-0000-0000-0000-0000000000e1',
    'species_base_id', 'b5800000-0000-0000-0000-0000000000e1',
    'foto_url', null, 'foto_base', pg_temp.foto58(p_n, 'v1'),
    'gps_base', pg_temp.punto58('O') - 'gps_accuracy',
    'usuario_registro', 'b5800000-0000-0000-0000-0000000000a2',
    'created_at', '2026-10-01T09:00:00+00:00'
  ) || pg_temp.punto58('O') || p_cambios;
$$;
create function pg_temp.grupo58(p_cambios jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', 'b5800000-0000-0000-0000-0000000000c1',
    'plantation_id', 'b5800000-0000-0000-0000-000000000002',
    'parcela_id', 'b5800000-0000-0000-0000-0000000000b1',
    'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'activa',
    'usuario_creador', 'b5800000-0000-0000-0000-0000000000a2',
    'created_at', '2026-10-01T09:00:00+00:00', 'parcela_codigo', 'P1',
    'base', jsonb_build_object('nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'activa')
  ) || p_cambios;
$$;

insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro, foto_url,
                   latitude, longitude, gps_accuracy, gps_captured_at)
select ('b5800000-0000-0000-0000-0000000000d' || n)::uuid, 'b5800000-0000-0000-0000-0000000000c1',
       'b5800000-0000-0000-0000-0000000000e1', n, 'P1L1T58A' || n, 'b5800000-0000-0000-0000-0000000000a2',
       pg_temp.foto58(n, 'v1'), -34.1, -58.1, 5, '2026-10-01T10:00:00+00:00'
  from generate_series(1, 5) as n;

-- Otro grupo del mismo técnico, con un árbol que nadie más puede mandar.
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b5800000-0000-0000-0000-0000000000c3', 'b5800000-0000-0000-0000-000000000002',
   'b5800000-0000-0000-0000-0000000000b1', 'Tres', 'L3', 'linea', 'activa', 'b5800000-0000-0000-0000-0000000000a2');
insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro, foto_url) values
  ('b5800000-0000-0000-0000-0000000000d8', 'b5800000-0000-0000-0000-0000000000c3',
   'b5800000-0000-0000-0000-0000000000e1', 1, 'P1L3T58A1', 'b5800000-0000-0000-0000-0000000000a2',
   pg_temp.foto58(8, 'v1'));

-- Los payloads, armados antes de cambiar de rol.
create temp table pedidos_58 (caso text primary key, grupo jsonb, arboles jsonb, esperado jsonb);
grant select on pedidos_58 to authenticated;

insert into pedidos_58 values
  ('sin conflicto',
   pg_temp.grupo58('{"nombre": "Uno bis"}'),
   jsonb_build_array(
     pg_temp.arbol58(1, pg_temp.punto58('T')),
     pg_temp.arbol58(2, jsonb_build_object('foto_url', pg_temp.foto58(2, 't1'))),
     pg_temp.arbol58(3, '{}')),
   '{"success": true, "conservadas": [], "conservados": {"grupo": {}, "arboles": []}}'),
  ('conflicto',
   pg_temp.grupo58('{"nombre": "Uno tec", "base": {"nombre": "Uno bis", "codigo": "L1", "tipo": "linea", "estado": "activa"}}'),
   jsonb_build_array(
     pg_temp.arbol58(1, pg_temp.punto58('N') || jsonb_build_object('gps_base', pg_temp.punto58('T') - 'gps_accuracy')),
     pg_temp.arbol58(2, jsonb_build_object('foto_url', pg_temp.foto58(2, 't2'), 'foto_base', pg_temp.foto58(2, 't1'))),
     pg_temp.arbol58(3, '{"species_id": "b5800000-0000-0000-0000-0000000000e3", "sub_id": "P1L1T58C3"}'),
     pg_temp.arbol58(4, '{}'),
     pg_temp.arbol58(5, '{}')),
   jsonb_build_object('success', true,
     'conservadas', '[{"id": "b5800000-0000-0000-0000-0000000000d3", "species_id": "b5800000-0000-0000-0000-0000000000e2"}]'::jsonb,
     'conservados', jsonb_build_object(
       'grupo', '{"nombre": "Uno admin", "estado": "finalizada"}'::jsonb,
       'arboles', jsonb_build_array(
         jsonb_build_object('id', 'b5800000-0000-0000-0000-0000000000d1', 'gps', pg_temp.punto58('A')),
         jsonb_build_object('id', 'b5800000-0000-0000-0000-0000000000d2', 'foto_url', pg_temp.foto58(2, 'a1')),
         '{"id": "b5800000-0000-0000-0000-0000000000d3", "species_id": "b5800000-0000-0000-0000-0000000000e2"}'::jsonb,
         jsonb_build_object('id', 'b5800000-0000-0000-0000-0000000000d4', 'gps', pg_temp.punto58('A')))))),
  ('conservar la mía',
   pg_temp.grupo58('{"nombre": "Uno tec", "estado": "finalizada", "base": {"nombre": "Uno admin", "codigo": "L1", "tipo": "linea", "estado": "finalizada"}}'),
   jsonb_build_array(
     pg_temp.arbol58(1, pg_temp.punto58('N') || jsonb_build_object('gps_base', pg_temp.punto58('A') - 'gps_accuracy')),
     pg_temp.arbol58(2, jsonb_build_object('foto_url', pg_temp.foto58(2, 't2'), 'foto_base', pg_temp.foto58(2, 'a1'))),
     pg_temp.arbol58(3, '{"species_id": "b5800000-0000-0000-0000-0000000000e3", "sub_id": "P1L1T58C3", "species_base_id": "b5800000-0000-0000-0000-0000000000e2"}'),
     pg_temp.arbol58(4, pg_temp.punto58('A') || jsonb_build_object('gps_base', pg_temp.punto58('A') - 'gps_accuracy'))),
   '{"success": true, "conservadas": [], "conservados": {"grupo": {}, "arboles": []}}'),
  ('base incompleta',
   pg_temp.grupo58('{"nombre": "Uno parcial", "estado": "finalizada", "base": {"codigo": "L1", "tipo": "linea", "estado": "finalizada"}}'),
   jsonb_build_array(pg_temp.arbol58(5, '{}')),
   '{"success": true, "conservadas": [], "conservados": {"grupo": {"tipo": "bosquete"}, "arboles": []}}'),
  ('sin base',
   pg_temp.grupo58('{"nombre": "Uno viejo", "estado": "finalizada"}') - 'base',
   jsonb_build_array(
     (pg_temp.arbol58(1, jsonb_build_object('foto_url', pg_temp.foto58(1, null))) - 'gps_base' - 'foto_base' - 'species_base_id')),
   '{"success": true, "conservadas": [], "conservados": {"grupo": {}, "arboles": []}}'),
  ('código conservado',
   pg_temp.grupo58('{"nombre": "Uno viejo", "estado": "finalizada", "base": {"nombre": "Uno viejo", "codigo": "L1", "tipo": "linea", "estado": "finalizada"}}'),
   jsonb_build_array(
     pg_temp.arbol58(6, '{"foto_base": null, "gps_base": null}')),
   '{"grupo": {"codigo": "L9"}, "arboles": []}'),
  ('árbol ajeno',
   pg_temp.grupo58('{"codigo": "L9", "estado": "finalizada", "base": {"nombre": "Uno viejo", "codigo": "L9", "tipo": "linea", "estado": "finalizada"}}'),
   jsonb_build_array(pg_temp.arbol58(8, jsonb_build_object('foto_url', pg_temp.foto58(8, 't1'), 'sub_id', 'P1L9T58A8'))),
   '{"success": false, "error": "UNKNOWN"}');

create temp view fotos_anotadas_58 as
  select storage_path from fotos_quitadas where plantation_id = 'b5800000-0000-0000-0000-000000000002';

-- ── Sin conflicto ────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) from pedidos_58 where caso = 'sin conflicto'),
  (select esperado from pedidos_58 where caso = 'sin conflicto'),
  'con la base igual al servidor no conserva nada');

reset role;

select is((select array[latitude, longitude] from trees where id = 'b5800000-0000-0000-0000-0000000000d1'),
  array[-34.3, -58.3]::float8[], 'el GPS del móvil entra');
select is((select foto_url from trees where id = 'b5800000-0000-0000-0000-0000000000d2'),
  pg_temp.foto58(2, 't1'), 'la foto del móvil entra');
select is((select nombre from groups where id = 'b5800000-0000-0000-0000-0000000000c1'),
  'Uno bis', 'el nombre del móvil entra');
select is((select array_agg(storage_path) from fotos_anotadas_58),
  array[pg_temp.foto58(2, 'v1')], 'la foto reemplazada queda anotada para el cron');

-- ── Conflicto en cada campo ──────────────────────────────────────────────────

-- El admin cambia GPS de d1 y d4, foto de d2, especie de d3, y nombre y estado del grupo.
update trees set latitude = -34.2, longitude = -58.2, gps_accuracy = 3, gps_captured_at = '2026-10-02T10:00:00+00:00'
  where id in ('b5800000-0000-0000-0000-0000000000d1', 'b5800000-0000-0000-0000-0000000000d4');
update trees set foto_url = pg_temp.foto58(2, 'a1') where id = 'b5800000-0000-0000-0000-0000000000d2';
update trees set species_id = 'b5800000-0000-0000-0000-0000000000e2', sub_id = 'P1L1T58B3'
  where id = 'b5800000-0000-0000-0000-0000000000d3';
update groups set nombre = 'Uno admin', estado = 'finalizada' where id = 'b5800000-0000-0000-0000-0000000000c1';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) from pedidos_58 where caso = 'conflicto'),
  (select esperado from pedidos_58 where caso = 'conflicto'),
  'devuelve lo que conservó: cambiado en los dos lados (d1, d2, d3, nombre) y solo en el servidor (d4, estado)');

reset role;

select is((select array[latitude, longitude, gps_accuracy] from trees where id = 'b5800000-0000-0000-0000-0000000000d1'),
  array[-34.2, -58.2, 3]::float8[], 'conserva el GPS del servidor');
select is((select gps_captured_at from trees where id = 'b5800000-0000-0000-0000-0000000000d1'),
  '2026-10-02T10:00:00+00:00'::timestamptz, 'con su momento de captura');
select is((select array[latitude, longitude] from trees where id = 'b5800000-0000-0000-0000-0000000000d4'),
  array[-34.2, -58.2]::float8[], 'una copia vieja que el móvil no cambió no revierte el GPS');
select is((select foto_url from trees where id = 'b5800000-0000-0000-0000-0000000000d2'),
  pg_temp.foto58(2, 'a1'), 'conserva la foto del servidor');
select is((select sub_id from trees where id = 'b5800000-0000-0000-0000-0000000000d3'),
  'P1L1T58B3', 'conserva la especie del servidor con su SubID');
select is((select array[nombre, estado] from groups where id = 'b5800000-0000-0000-0000-0000000000c1'),
  array['Uno admin', 'finalizada'], 'conserva nombre y estado del servidor');
select ok(exists(select 1 from fotos_anotadas_58 where storage_path = pg_temp.foto58(2, 't2')),
  'la foto del móvil que no entró queda anotada para el cron');
select ok(not exists(select 1 from fotos_anotadas_58 where storage_path = pg_temp.foto58(2, 'a1')),
  'la foto del servidor no se anota');
select is((select foto_url from trees where id = 'b5800000-0000-0000-0000-0000000000d5'),
  pg_temp.foto58(5, 'v1'), 'sin foto nueva y con la base vigente, la foto sigue');

-- ── Conservar la mía: la base es el valor del servidor ───────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) from pedidos_58 where caso = 'conservar la mía'),
  (select esperado from pedidos_58 where caso = 'conservar la mía'),
  'con la base del servidor no hay conflicto');

reset role;

select is((select array[latitude, longitude] from trees where id = 'b5800000-0000-0000-0000-0000000000d1'),
  array[-34.4, -58.4]::float8[], 'el GPS del móvil pisa');
select is((select foto_url from trees where id = 'b5800000-0000-0000-0000-0000000000d2'),
  pg_temp.foto58(2, 't2'), 'la foto del móvil pisa');
select is((select sub_id from trees where id = 'b5800000-0000-0000-0000-0000000000d3'),
  'P1L1T58C3', 'la especie del móvil pisa');
select is((select nombre from groups where id = 'b5800000-0000-0000-0000-0000000000c1'),
  'Uno tec', 'el nombre del móvil pisa');
select ok(exists(select 1 from fotos_anotadas_58 where storage_path = pg_temp.foto58(2, 'a1')),
  'la foto del servidor reemplazada queda anotada');

-- Reintento: la respuesta se perdió y el móvil manda lo mismo.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) from pedidos_58 where caso = 'conservar la mía'),
  (select esperado from pedidos_58 where caso = 'conservar la mía'),
  'reenviar lo que ya entró no devuelve conflictos');

reset role;

-- La foto del móvil que había perdido volvió a ser la del árbol: el cron no la borra.
create temp table limpieza_58 as select * from fotos_quitadas_por_limpiar(100);
select is(
  (select array_agg(distinct resultado) from fotos_quitadas where storage_path = pg_temp.foto58(2, 't2')),
  array['reasignada'], 'el cron marca reasignada la foto que volvió a subir');

-- ── Base incompleta: el campo sin base se pisa ───────────────────────────────

update groups set tipo = 'bosquete', nombre = 'Uno admin 3' where id = 'b5800000-0000-0000-0000-0000000000c1';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) from pedidos_58 where caso = 'base incompleta'),
  (select esperado from pedidos_58 where caso = 'base incompleta'),
  'conserva el tipo del servidor');

reset role;

select is((select nombre from groups where id = 'b5800000-0000-0000-0000-0000000000c1'),
  'Uno parcial', 'el nombre sin base pisa');

-- ── Sin base: un APK viejo pisa como antes ───────────────────────────────────

update trees set latitude = -34.2, longitude = -58.2 where id = 'b5800000-0000-0000-0000-0000000000d1';
update groups set nombre = 'Uno admin 2' where id = 'b5800000-0000-0000-0000-0000000000c1';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) from pedidos_58 where caso = 'sin base'),
  (select esperado from pedidos_58 where caso = 'sin base'),
  'sin base no conserva nada');

reset role;

select is((select array[latitude, longitude] from trees where id = 'b5800000-0000-0000-0000-0000000000d1'),
  array[-34.1, -58.1]::float8[], 'el GPS del APK viejo pisa');
select is((select foto_url from trees where id = 'b5800000-0000-0000-0000-0000000000d1'),
  pg_temp.foto58(1, null), 'la foto del APK viejo, con el path sin versión, pisa');
select is((select nombre from groups where id = 'b5800000-0000-0000-0000-0000000000c1'),
  'Uno viejo', 'el nombre del APK viejo pisa');

-- ── Código de grupo conservado ───────────────────────────────────────────────

-- El creador pasó el grupo a L9 en otro celular y creó otro con L1.
update groups set codigo = 'L9' where id = 'b5800000-0000-0000-0000-0000000000c1';
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b5800000-0000-0000-0000-0000000000c2', 'b5800000-0000-0000-0000-000000000002',
   'b5800000-0000-0000-0000-0000000000b1', 'Dos', 'L1', 'linea', 'activa', 'b5800000-0000-0000-0000-0000000000a2');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) -> 'conservados' from pedidos_58 where caso = 'código conservado'),
  (select esperado from pedidos_58 where caso = 'código conservado'),
  'un código viejo que el servidor conserva no es un duplicado y vuelve el vigente');

reset role;

select is((select sub_id from trees where id = 'b5800000-0000-0000-0000-0000000000d6'),
  'P1L9T58A6', 'el SubID lleva el código de grupo que conservó el servidor');
select is((select codigo from groups where id = 'b5800000-0000-0000-0000-0000000000c1'),
  'L9', 'el grupo conserva su código');

-- ── Rechazos ─────────────────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);

select is(
  (select sync_subgroup(grupo, arboles) from pedidos_58 where caso = 'árbol ajeno'),
  (select esperado from pedidos_58 where caso = 'árbol ajeno'),
  'un árbol de otro grupo en el payload rechaza la subida');

select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a3', true);
select is(
  (select sync_subgroup(grupo, arboles) ->> 'error' from pedidos_58 where caso = 'conservar la mía'),
  'PERMISSION', 'con base, un técnico no sube un grupo ajeno');

reset role;

select ok(not exists(select 1 from fotos_quitadas where tree_id = 'b5800000-0000-0000-0000-0000000000d8'),
  'la subida rechazada no anota fotos');

-- ── Path versionado ──────────────────────────────────────────────────────────

select is(arbol_de_foto(pg_temp.foto58(1, '1728400000000')),
  'b5800000-0000-0000-0000-0000000000d1'::uuid, 'arbol_de_foto lee el id de un path versionado');
select is(arbol_de_foto(pg_temp.foto58(1, 'a_b')), null::uuid,
  'arbol_de_foto: una versión con otros caracteres no es de un árbol');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a3', true);
select ok(not puede_escribir_foto(pg_temp.foto58(1, '1728400000000')),
  'un técnico no escribe un path versionado de un árbol ajeno');
select set_config('request.jwt.claim.sub', 'b5800000-0000-0000-0000-0000000000a2', true);
select ok(puede_escribir_foto(pg_temp.foto58(1, '1728400000000')),
  'el creador sí');
reset role;

select * from finish();
rollback;
