-- Especie científica como entidad (#753): nombre normalizado y único sin
-- distinguir mayúsculas, RLS como species, borrado restringido y la copia en
-- species.nombre_cientifico que mantienen los triggers.
begin;
select plan(15);

insert into organizations (id, nombre) values
  ('b5300000-0000-0000-0000-000000000001', 'Org Test 53');
insert into auth.users (id, email) values
  ('b5300000-0000-0000-0000-0000000000a1', 'admin-53@test.local'),
  ('b5300000-0000-0000-0000-0000000000a2', 'tecnico-53@test.local');
update profiles set rol = 'admin', organizacion_id = 'b5300000-0000-0000-0000-000000000001'
  where id = 'b5300000-0000-0000-0000-0000000000a1';
update profiles set rol = 'tecnico', organizacion_id = 'b5300000-0000-0000-0000-000000000001'
  where id = 'b5300000-0000-0000-0000-0000000000a2';

insert into especies_cientificas (id, nombre) values
  ('b5300000-0000-0000-0000-0000000000c1', '  Prosopis    alba ');

select is((select nombre from especies_cientificas where id = 'b5300000-0000-0000-0000-0000000000c1'),
  'Prosopis alba', 'el nombre se guarda sin espacios de más');

select throws_ok(
  $$insert into especies_cientificas (nombre) values ('PROSOPIS  ALBA')$$,
  '23505', null, 'un nombre que solo cambia en mayúsculas o espacios se rechaza');

select throws_ok(
  $$insert into especies_cientificas (nombre) values ('   ')$$,
  '23514', null, 'un nombre vacío se rechaza');

-- La copia en species.
insert into species (id, codigo, nombre, especie_cientifica_id) values
  ('b5300000-0000-0000-0000-0000000000e1', 'T53A', 'Algarrobo blanco', 'b5300000-0000-0000-0000-0000000000c1'),
  ('b5300000-0000-0000-0000-0000000000e2', 'T53B', 'Igarobá', 'b5300000-0000-0000-0000-0000000000c1');
insert into species (id, codigo, nombre, nombre_cientifico) values
  ('b5300000-0000-0000-0000-0000000000e3', 'T53C', 'Sin vínculo', 'Texto suelto');

select is((select array_agg(nombre_cientifico order by codigo) from species where codigo in ('T53A', 'T53B')),
  array['Prosopis alba', 'Prosopis alba'], 'dos especies con distinto nombre común copian la misma especie científica');

select is((select nombre_cientifico from species where codigo = 'T53C'), null,
  'sin vínculo, la copia queda en null aunque se escriba el texto');

update especies_cientificas set nombre = 'Prosopis  alba var. panta'
 where id = 'b5300000-0000-0000-0000-0000000000c1';

select is((select array_agg(nombre_cientifico order by codigo) from species where codigo in ('T53A', 'T53B')),
  array['Prosopis alba var. panta', 'Prosopis alba var. panta'], 'renombrar la especie científica actualiza la copia en todas sus especies');

update species set especie_cientifica_id = null where codigo = 'T53B';
select is((select nombre_cientifico from species where codigo = 'T53B'), null,
  'desvincular deja la copia en null');

select throws_ok(
  $$delete from especies_cientificas where id = 'b5300000-0000-0000-0000-0000000000c1'$$,
  '23503', null, 'una especie científica que agrupa especies no se borra');

-- RLS, como técnico.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5300000-0000-0000-0000-0000000000a2', true);

select is((select count(*) from especies_cientificas where id = 'b5300000-0000-0000-0000-0000000000c1'),
  1::bigint, 'un técnico lee las especies científicas');

select throws_ok(
  $$insert into especies_cientificas (nombre) values ('Schinus molle')$$,
  '42501', null, 'un técnico no crea especies científicas');

update especies_cientificas set nombre = 'Cambiado por técnico'
 where id = 'b5300000-0000-0000-0000-0000000000c1';
select set_config('request.jwt.claim.sub', 'b5300000-0000-0000-0000-0000000000a1', true);
select is((select nombre from especies_cientificas where id = 'b5300000-0000-0000-0000-0000000000c1'),
  'Prosopis alba var. panta', 'un técnico no renombra especies científicas');

-- RLS, como admin.
select lives_ok(
  $$insert into especies_cientificas (id, nombre) values ('b5300000-0000-0000-0000-0000000000c2', 'Schinus molle')$$,
  'un admin crea especies científicas');

select lives_ok(
  $$update species set especie_cientifica_id = 'b5300000-0000-0000-0000-0000000000c2' where codigo = 'T53C'$$,
  'un admin vincula una especie');

select is((select nombre_cientifico from species where codigo = 'T53C'), 'Schinus molle',
  'la copia sigue al vínculo que hace un admin');

update species set especie_cientifica_id = null where codigo = 'T53C';
delete from especies_cientificas where id = 'b5300000-0000-0000-0000-0000000000c2';
select is((select count(*) from especies_cientificas where id = 'b5300000-0000-0000-0000-0000000000c2'),
  0::bigint, 'un admin borra una especie científica que no agrupa ninguna especie');

select * from finish();
rollback;
