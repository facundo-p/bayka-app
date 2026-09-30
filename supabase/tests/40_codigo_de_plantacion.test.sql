-- Código de plantación (062, #559): formato, único por organización, solo cambia
-- con la plantación activa, y el backfill de las que no tenían.
begin;
select plan(33);

insert into organizations (id, nombre) values
  ('b4000000-0000-0000-0000-000000000001', 'Org Test 40'),
  ('b4000000-0000-0000-0000-000000000009', 'Otra Org 40');

insert into auth.users (id, email) values
  ('b4000000-0000-0000-0000-0000000000a1', 'admin-40@test.local'),
  ('b4000000-0000-0000-0000-0000000000a9', 'admin-otra-40@test.local');

update profiles set rol = 'admin', organizacion_id = 'b4000000-0000-0000-0000-000000000001'
  where id = 'b4000000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', organizacion_id = 'b4000000-0000-0000-0000-000000000009'
  where id = 'b4000000-0000-0000-0000-0000000000a9';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, codigo) values
  ('b4000000-0000-0000-0000-000000000010', 'b4000000-0000-0000-0000-000000000001',
   'Activa 40', '2026', 'b4000000-0000-0000-0000-0000000000a1', 'activa', 'AC40'),
  ('b4000000-0000-0000-0000-000000000011', 'b4000000-0000-0000-0000-000000000001',
   'Finalizada 40', '2026', 'b4000000-0000-0000-0000-0000000000a1', 'finalizada', 'FI40'),
  ('b4000000-0000-0000-0000-000000000012', 'b4000000-0000-0000-0000-000000000001',
   'Archivada 40', '2026', 'b4000000-0000-0000-0000-0000000000a1', 'activa', 'AR40');

update plantations set archivada_en = now() where id = 'b4000000-0000-0000-0000-000000000012';

-- ── Columna y formato ────────────────────────────────────────────────────────

select col_not_null('public', 'plantations', 'codigo', 'codigo es obligatorio');

select ok(codigo_de_plantacion_valido('SS26-1'), 'letras, dígitos y un guion en el medio');
select ok(codigo_de_plantacion_valido('A-B-C'), 'varios guiones sueltos');
select ok(codigo_de_plantacion_valido('12345678'), 'ocho caracteres');
select ok(not codigo_de_plantacion_valido('123456789'), 'nueve caracteres no');
select ok(not codigo_de_plantacion_valido('ss26'), 'minúsculas no');
select ok(not codigo_de_plantacion_valido('-SS26'), 'guion al principio no');
select ok(not codigo_de_plantacion_valido('SS26-'), 'guion al final no');
select ok(not codigo_de_plantacion_valido('SS--26'), 'dos guiones seguidos no');
select ok(not codigo_de_plantacion_valido('SS 26'), 'espacios no');
select ok(not codigo_de_plantacion_valido('SÑ26'), 'fuera de A-Z no');
select ok(not codigo_de_plantacion_valido(''), 'vacío no');

select throws_ok(
  $$insert into plantations (organizacion_id, lugar, periodo, creado_por, codigo) values
    ('b4000000-0000-0000-0000-000000000001', 'Minúsculas 40', '2026',
     'b4000000-0000-0000-0000-0000000000a1', 'ab12')$$,
  '23514', null, 'la base rechaza un código con formato inválido');
select throws_ok(
  $$insert into plantations (organizacion_id, lugar, periodo, creado_por) values
    ('b4000000-0000-0000-0000-000000000001', 'Sin código 40', '2026',
     'b4000000-0000-0000-0000-0000000000a1')$$,
  '23502', null, 'y un alta sin código');

-- ── Único por organización ───────────────────────────────────────────────────

select throws_ok(
  $$insert into plantations (organizacion_id, lugar, periodo, creado_por, codigo) values
    ('b4000000-0000-0000-0000-000000000001', 'Repetida 40', '2026',
     'b4000000-0000-0000-0000-0000000000a1', 'AC40')$$,
  '23505', null, 'dos plantaciones de la misma organización no comparten código');
select lives_ok(
  $$insert into plantations (organizacion_id, lugar, periodo, creado_por, codigo) values
    ('b4000000-0000-0000-0000-000000000009', 'De otra org 40', '2026',
     'b4000000-0000-0000-0000-0000000000a9', 'AC40')$$,
  'en otra organización el mismo código se permite');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, codigo) values
  ('b4000000-0000-0000-0000-000000000013', 'b4000000-0000-0000-0000-000000000001',
   'A borrar 40', '2026', 'b4000000-0000-0000-0000-0000000000a1', 'BO40');
delete from plantations where id = 'b4000000-0000-0000-0000-000000000013';
select lives_ok(
  $$insert into plantations (organizacion_id, lugar, periodo, creado_por, codigo) values
    ('b4000000-0000-0000-0000-000000000001', 'Recreada 40', '2026',
     'b4000000-0000-0000-0000-0000000000a1', 'BO40')$$,
  'una plantación eliminada no reserva su código');

-- ── Solo cambia con la plantación activa ─────────────────────────────────────

select lives_ok(
  $$update plantations set codigo = 'AC40-B' where id = 'b4000000-0000-0000-0000-000000000010'$$,
  'el código de una activa cambia');
select throws_ok(
  $$update plantations set codigo = 'FI40-B' where id = 'b4000000-0000-0000-0000-000000000011'$$,
  '42501', null, 'el de una finalizada no, ni siquiera por fuera de las policies');
select throws_ok(
  $$update plantations set codigo = 'AR40-B' where id = 'b4000000-0000-0000-0000-000000000012'$$,
  '42501', null, 'el de una archivada tampoco');
select lives_ok(
  $$update plantations set lugar = 'Finalizada 40 bis' where id = 'b4000000-0000-0000-0000-000000000011'$$,
  'el trigger no toca los demás campos');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-0000000000a1', true);
select throws_ok(
  $$update plantations set codigo = 'AC40-C' where id = 'b4000000-0000-0000-0000-000000000010'$$,
  '42501', null, 'el código no se cambia por UPDATE directo: solo por editar_plantacion');
select lives_ok(
  $$insert into plantations (organizacion_id, lugar, periodo, creado_por, codigo) values
    ('b4000000-0000-0000-0000-000000000001', 'Alta admin 40', '2026',
     'b4000000-0000-0000-0000-0000000000a1', 'AL40')$$,
  'un admin crea una plantación con su código');
reset role;

-- ── Backfill ─────────────────────────────────────────────────────────────────

-- Simula la base antes de 062: filas sin código.
alter table plantations alter column codigo drop not null;

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, created_at) values
  ('b4000000-0000-0000-0000-000000000020', 'b4000000-0000-0000-0000-000000000001',
   'San Sebastián de la Selva', 'Otoño 2026', 'b4000000-0000-0000-0000-0000000000a1', '2026-01-01'),
  ('b4000000-0000-0000-0000-000000000021', 'b4000000-0000-0000-0000-000000000001',
   ' San Sebastián de la Selva - GSC ', '2026', 'b4000000-0000-0000-0000-0000000000a1', '2026-01-02'),
  ('b4000000-0000-0000-0000-000000000022', 'b4000000-0000-0000-0000-000000000001',
   'Pruebas 40', '2026', 'b4000000-0000-0000-0000-0000000000a1', '2026-03-01'),
  ('b4000000-0000-0000-0000-000000000023', 'b4000000-0000-0000-0000-000000000001',
   'Pruebas viejas 40', '2025', 'b4000000-0000-0000-0000-0000000000a1', '2025-03-01'),
  ('b4000000-0000-0000-0000-000000000024', 'b4000000-0000-0000-0000-000000000009',
   'Pruebas otra org 40', '2026', 'b4000000-0000-0000-0000-0000000000a9', '2026-03-01');

select lives_ok($$select asignar_codigos_de_plantacion_faltantes()$$, 'el backfill corre');
select is(
  (select codigo from plantations where id = 'b4000000-0000-0000-0000-000000000020'),
  'SS26-1', 'San Sebastián de la Selva (Otoño 2026) recibe SS26-1');
select is(
  (select codigo from plantations where id = 'b4000000-0000-0000-0000-000000000021'),
  'SS26-2', 'San Sebastián de la Selva - GSC (2026) recibe SS26-2, con espacios de más');
select is(
  (select codigo from plantations where id = 'b4000000-0000-0000-0000-000000000023'),
  'P1', 'las demás, P<n> por orden de creación');
select is(
  (select codigo from plantations where id = 'b4000000-0000-0000-0000-000000000022'),
  'P2', 'la más nueva, el número siguiente');
select is(
  (select codigo from plantations where id = 'b4000000-0000-0000-0000-000000000024'),
  'P1', 'numeradas por organización');
select is(
  (select codigo from plantations where id = 'b4000000-0000-0000-0000-000000000010'),
  'AC40-B', 'las que ya tenían código no cambian');

insert into plantations (organizacion_id, lugar, periodo, creado_por) values
  ('b4000000-0000-0000-0000-000000000009', 'San Sebastián de la Selva', 'Otoño 2026',
   'b4000000-0000-0000-0000-0000000000a9'),
  ('b4000000-0000-0000-0000-000000000009', 'San Sebastián de la Selva', 'Otoño 2026',
   'b4000000-0000-0000-0000-0000000000a9');
select throws_like(
  $$select asignar_codigos_de_plantacion_faltantes()$$,
  'Más de una plantación calza con el código SS26-1%',
  'dos que calzan con el mismo código en una organización: falla en vez de elegir');
delete from plantations where codigo is null;

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('b4000000-0000-0000-0000-000000000030', 'b4000000-0000-0000-0000-000000000009',
   'San Sebastián de la Selva', 'Primavera 2026', 'b4000000-0000-0000-0000-0000000000a9');
select throws_like(
  $$select asignar_codigos_de_plantacion_faltantes()$$,
  'La plantación b4000000-0000-0000-0000-000000000030 % no calza con ningún código manual%',
  'una de San Sebastián que no calza: falla en vez de inventarle un código');
select is(
  (select codigo from plantations where id = 'b4000000-0000-0000-0000-000000000030'),
  null, 'y no le asigna nada');

select * from finish();
rollback;
