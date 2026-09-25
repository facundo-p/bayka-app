-- editar_plantacion y el UPDATE directo acotado (057, #634).
-- Ramas de la RPC: sin conflicto, conflicto en el mismo campo, campos distintos,
-- mismo valor en los dos lados, datos inválidos, y los rechazos de siempre. Y el
-- UPDATE directo: `estado` solo pasa de activa a finalizada, y las columnas
-- sensibles no se tocan.
begin;
select plan(30);

insert into organizations (id, nombre) values
  ('b3500000-0000-0000-0000-000000000001', 'Org Test 35'),
  ('b3500000-0000-0000-0000-000000000009', 'Otra Org 35');

insert into auth.users (id, email) values
  ('b3500000-0000-0000-0000-0000000000a1', 'admin-35@test.local'),
  ('b3500000-0000-0000-0000-0000000000a2', 'web-35@test.local'),
  ('b3500000-0000-0000-0000-0000000000a3', 'tecnico-35@test.local'),
  ('b3500000-0000-0000-0000-0000000000a4', 'super-35@test.local'),
  ('b3500000-0000-0000-0000-0000000000a5', 'admin-otra-35@test.local');

update profiles set rol = 'admin', nombre = 'Admin 35', organizacion_id = 'b3500000-0000-0000-0000-000000000001'
  where id = 'b3500000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', nombre = 'Ana', organizacion_id = 'b3500000-0000-0000-0000-000000000001'
  where id = 'b3500000-0000-0000-0000-0000000000a2';
update profiles set organizacion_id = 'b3500000-0000-0000-0000-000000000001'
  where id = 'b3500000-0000-0000-0000-0000000000a3';
update profiles set rol = 'superadmin', organizacion_id = 'b3500000-0000-0000-0000-000000000001'
  where id = 'b3500000-0000-0000-0000-0000000000a4';
update profiles set rol = 'admin', organizacion_id = 'b3500000-0000-0000-0000-000000000009'
  where id = 'b3500000-0000-0000-0000-0000000000a5';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, objetivo_arboles) values
  ('b3500000-0000-0000-0000-000000000002', 'b3500000-0000-0000-0000-000000000001',
   'Lote Norte', '2026', 'b3500000-0000-0000-0000-0000000000a1', 'activa', 12000),
  ('b3500000-0000-0000-0000-000000000003', 'b3500000-0000-0000-0000-000000000001',
   'Finalizada 35', '2026', 'b3500000-0000-0000-0000-0000000000a1', 'finalizada', null),
  ('b3500000-0000-0000-0000-000000000004', 'b3500000-0000-0000-0000-000000000001',
   'Archivada 35', '2026', 'b3500000-0000-0000-0000-0000000000a1', 'activa', null),
  ('b3500000-0000-0000-0000-000000000005', 'b3500000-0000-0000-0000-000000000001',
   'A finalizar 35', '2026', 'b3500000-0000-0000-0000-0000000000a1', 'activa', null);

update plantations set archivada_en = now(), archivada_por = 'b3500000-0000-0000-0000-0000000000a1'
  where id = 'b3500000-0000-0000-0000-000000000004';

create temp view plantacion_35 as
  select lugar, descripcion, objetivo_arboles, visible_in_app, estado, organizacion_id, creado_por, ultima_edicion
  from plantations where id = 'b3500000-0000-0000-0000-000000000002';
grant select on plantacion_35 to authenticated;

set local role authenticated;

-- ── UPDATE directo ───────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3500000-0000-0000-0000-0000000000a4', true);
select throws_ok(
  $$update plantations set estado = 'activa' where id = 'b3500000-0000-0000-0000-000000000003'$$,
  '42501', null, 'un superadmin no reabre con un UPDATE directo');

select set_config('request.jwt.claim.sub', 'b3500000-0000-0000-0000-0000000000a2', true);
select throws_ok(
  $$update plantations set organizacion_id = 'b3500000-0000-0000-0000-000000000009'
    where id = 'b3500000-0000-0000-0000-000000000002'$$,
  '42501', null, 'organizacion_id no se cambia por UPDATE');
select throws_ok(
  $$update plantations set creado_por = 'b3500000-0000-0000-0000-0000000000a2'
    where id = 'b3500000-0000-0000-0000-000000000002'$$,
  '42501', null, 'creado_por no se cambia por UPDATE');
select throws_ok(
  $$update plantations set ultima_edicion = '{}' where id = 'b3500000-0000-0000-0000-000000000002'$$,
  '42501', null, 'la auditoría no se escribe por UPDATE');
select lives_ok(
  $$update plantations set estado = 'finalizada' where id = 'b3500000-0000-0000-0000-000000000005'$$,
  'finalizar (activa → finalizada) sigue siendo un UPDATE');

-- Ana cambia el objetivo desde la web (UPDATE directo, como un APK viejo).
select lives_ok(
  $$update plantations set objetivo_arboles = 12500 where id = 'b3500000-0000-0000-0000-000000000002'$$,
  'los campos editables siguen abiertos al UPDATE');
select is(
  (select ultima_edicion -> 'objetivo_arboles' ->> 'por' from plantacion_35),
  'b3500000-0000-0000-0000-0000000000a2', 'el trigger registra quién cambió el campo');
select is(
  (select ultima_edicion ? 'lugar' from plantacion_35), false,
  'y solo el campo que cambió');

-- ── editar_plantacion ────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3500000-0000-0000-0000-0000000000a1', true);

-- Campos distintos: el teléfono cambió la descripción, Ana el objetivo.
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002',
    '{"descripcion": "Ribera norte"}', '{"descripcion": null}'),
  '{"success": true}'::jsonb, 'sin conflicto aplica el cambio');
select is((select descripcion from plantacion_35), 'Ribera norte', 'la descripción quedó guardada');
select is((select objetivo_arboles from plantacion_35), 12500, 'y el cambio de la web se conserva');

-- Mismo campo: el teléfono cambió el objetivo a 15000 desde 12000, y el lugar.
select is(
  (select editar_plantacion('b3500000-0000-0000-0000-000000000002',
    '{"objetivo_arboles": 15000, "lugar": "Lote Norte Bajo"}',
    '{"objetivo_arboles": 12000, "lugar": "Lote Norte"}') - 'conflictos'),
  '{"success": false, "error": "CONFLICTO_EDICION", "aplicados": ["lugar"]}'::jsonb,
  'un conflicto devuelve CONFLICTO_EDICION y los campos que sí aplicó');
select is((select objetivo_arboles from plantacion_35), 12500, 'el campo en conflicto no se aplica');
select is((select lugar from plantacion_35), 'Lote Norte Bajo', 'el otro campo sí');

select is(
  (select c - 'editado_en' from jsonb_array_elements(
    editar_plantacion('b3500000-0000-0000-0000-000000000002',
      '{"objetivo_arboles": 15000}', '{"objetivo_arboles": 12000}') -> 'conflictos') c),
  '{"campo": "objetivo_arboles", "valor_servidor": 12500, "editado_por": "Ana"}'::jsonb,
  'el conflicto trae el valor del server y quién lo cambió');
select isnt(
  (select c ->> 'editado_en' from jsonb_array_elements(
    editar_plantacion('b3500000-0000-0000-0000-000000000002',
      '{"objetivo_arboles": 15000}', '{"objetivo_arboles": 12000}') -> 'conflictos') c),
  null, 'y cuándo');

select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002',
    '{"objetivo_arboles": 12500}', '{"objetivo_arboles": 12000}'),
  '{"success": true}'::jsonb, 'si los dos cambiaron al mismo valor no hay conflicto');

-- Elegir "mi cambio": se reenvía con la base nueva, el valor de la web.
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002',
    '{"objetivo_arboles": 15000}', '{"objetivo_arboles": 12500}'),
  '{"success": true}'::jsonb, 'reenviado con la base nueva se aplica');
select is((select objetivo_arboles from plantacion_35), 15000, 'y queda mi valor');

-- ── Validación ───────────────────────────────────────────────────────────────

select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002', '{"lugar": "  "}', '{"lugar": "Lote Norte Bajo"}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "lugar"}'::jsonb, 'el lugar vacío se rechaza');
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002', '{"objetivo_arboles": 0}', '{"objetivo_arboles": 15000}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "objetivo_arboles"}'::jsonb,
  'el objetivo menor a 1 se rechaza');
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002', '{"fecha_inicio": "2026-02-30"}', '{"fecha_inicio": null}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "fecha_inicio"}'::jsonb,
  'una fecha inexistente se rechaza');
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002', '{"estado": "finalizada"}', '{"estado": "activa"}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "estado"}'::jsonb,
  'estado no se edita por la RPC');
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002', '{"visible_in_app": false}', '{}'),
  '{"success": false, "error": "DATOS_INVALIDOS", "campo": "visible_in_app"}'::jsonb,
  'un cambio sin base se rechaza');

-- ── Rechazos ─────────────────────────────────────────────────────────────────

select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000003', '{"lugar": "X"}', '{"lugar": "Finalizada 35"}') ->> 'error',
  'PLANTACION_FINALIZADA', 'una finalizada se rechaza');
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000004', '{"lugar": "X"}', '{"lugar": "Archivada 35"}') ->> 'error',
  'PLANTACION_ARCHIVADA', 'una archivada se rechaza');
select is(
  editar_plantacion('b3500000-0000-0000-0000-0000000000ff', '{"lugar": "X"}', '{"lugar": "Y"}') ->> 'error',
  'PLANTACION_INEXISTENTE', 'una eliminada se informa como inexistente');

select set_config('request.jwt.claim.sub', 'b3500000-0000-0000-0000-0000000000a3', true);
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002', '{"lugar": "X"}', '{"lugar": "Lote Norte Bajo"}') ->> 'error',
  'NOT_AUTHORIZED', 'un técnico no edita');

select set_config('request.jwt.claim.sub', 'b3500000-0000-0000-0000-0000000000a5', true);
select is(
  editar_plantacion('b3500000-0000-0000-0000-000000000002', '{"lugar": "X"}', '{"lugar": "Lote Norte Bajo"}') ->> 'error',
  'NOT_AUTHORIZED', 'un admin de otra organización no edita');

reset role;
select is((select lugar from plantacion_35), 'Lote Norte Bajo', 'los rechazos no dejan efectos');

select * from finish();
rollback;
