-- Reemplazo de especies y técnicos en un solo RPC (049, #544): mismos gates que las
-- policies, rechazos sin tocar nada y membresías admin e inactivas intactas.
begin;
select plan(34);

insert into organizations (id, nombre) values
  ('b2700000-0000-0000-0000-00000000000a', 'Org A Test 27'),
  ('b2700000-0000-0000-0000-00000000000b', 'Org B Test 27');

insert into auth.users (id, email) values
  ('b2700000-0000-0000-0000-0000000000a1', 'admin-27@test.local'),
  ('b2700000-0000-0000-0000-0000000000a2', 'super-27@test.local'),
  ('b2700000-0000-0000-0000-0000000000a3', 'tecnico-27@test.local'),
  ('b2700000-0000-0000-0000-0000000000a4', 'tecnico2-27@test.local'),
  ('b2700000-0000-0000-0000-0000000000a5', 'tecnico-inactivo-27@test.local'),
  ('b2700000-0000-0000-0000-0000000000b1', 'admin-b-27@test.local'),
  ('b2700000-0000-0000-0000-0000000000b3', 'tecnico-b-27@test.local');

update profiles set organizacion_id = 'b2700000-0000-0000-0000-00000000000a'
  where id::text like 'b2700000-0000-0000-0000-0000000000a%';
update profiles set organizacion_id = 'b2700000-0000-0000-0000-00000000000b'
  where id::text like 'b2700000-0000-0000-0000-0000000000b%';
update profiles set rol = 'admin'
  where id in ('b2700000-0000-0000-0000-0000000000a1', 'b2700000-0000-0000-0000-0000000000b1');
update profiles set rol = 'superadmin' where id = 'b2700000-0000-0000-0000-0000000000a2';

-- aa: activa. af: finalizada. ac: archivada. bb: de la organización B.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, archivada_en) values
  ('b2700000-0000-0000-0000-0000000000aa', 'b2700000-0000-0000-0000-00000000000a',
   'Activa 27', '2026', 'b2700000-0000-0000-0000-0000000000a1', 'activa', null),
  ('b2700000-0000-0000-0000-0000000000af', 'b2700000-0000-0000-0000-00000000000a',
   'Finalizada 27', '2026', 'b2700000-0000-0000-0000-0000000000a1', 'finalizada', null),
  ('b2700000-0000-0000-0000-0000000000ac', 'b2700000-0000-0000-0000-00000000000a',
   'Archivada 27', '2026', 'b2700000-0000-0000-0000-0000000000a1', 'activa', now()),
  ('b2700000-0000-0000-0000-0000000000bb', 'b2700000-0000-0000-0000-00000000000b',
   'Plantación B 27', '2026', 'b2700000-0000-0000-0000-0000000000b1', 'activa', null);

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b2700000-0000-0000-0000-0000000000aa', 'b2700000-0000-0000-0000-0000000000a3', 'tecnico'),
  ('b2700000-0000-0000-0000-0000000000aa', 'b2700000-0000-0000-0000-0000000000a5', 'tecnico'),
  ('b2700000-0000-0000-0000-0000000000af', 'b2700000-0000-0000-0000-0000000000a3', 'tecnico'),
  ('b2700000-0000-0000-0000-0000000000ac', 'b2700000-0000-0000-0000-0000000000a3', 'tecnico'),
  ('b2700000-0000-0000-0000-0000000000bb', 'b2700000-0000-0000-0000-0000000000b3', 'tecnico');

update profiles set activo = false where id = 'b2700000-0000-0000-0000-0000000000a5';

insert into species (id, codigo, nombre) values
  ('b2700000-0000-0000-0000-000000000051', 'SP27a', 'Especie 27a'),
  ('b2700000-0000-0000-0000-000000000052', 'SP27b', 'Especie 27b'),
  ('b2700000-0000-0000-0000-000000000053', 'SP27c', 'Especie 27c');

insert into plantation_species (plantation_id, species_id, orden_visual)
select p.id, 'b2700000-0000-0000-0000-000000000051', 0
from plantations p where p.id::text like 'b2700000-%';

create temp view especies_27 as
  select plantation_id, species_id, orden_visual from plantation_species
  where plantation_id::text like 'b2700000-%';
create temp view asignaciones_27 as
  select plantation_id, user_id, rol_en_plantacion from plantation_users
  where plantation_id::text like 'b2700000-%';
grant select on especies_27, asignaciones_27 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2700000-0000-0000-0000-0000000000a1', true);

-- ── Especies ─────────────────────────────────────────────────────────────────
select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000aa',
  '[{"species_id": "b2700000-0000-0000-0000-000000000052", "orden_visual": 0},
    {"species_id": "b2700000-0000-0000-0000-000000000053", "orden_visual": 1}]'),
  '{"success": true}'::jsonb, 'admin reemplaza las especies de una activa');
select is((select string_agg(species_id::text || ':' || orden_visual, ',' order by orden_visual)
  from especies_27 where plantation_id = 'b2700000-0000-0000-0000-0000000000aa'),
  'b2700000-0000-0000-0000-000000000052:0,b2700000-0000-0000-0000-000000000053:1',
  'quedan exactamente las especies nuevas, con su orden');

select throws_ok(
  $$ select reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000aa',
     '[{"species_id": "b2700000-0000-0000-0000-000000000051"},
       {"species_id": "b2700000-0000-0000-0000-000000000051"}]') $$,
  '23505', null, 'un error al insertar aborta el reemplazo');
select is((select count(*)::int from especies_27
  where plantation_id = 'b2700000-0000-0000-0000-0000000000aa'), 2,
  'el borrado de ese reemplazo no quedó aplicado');

select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000aa',
  '[{"species_id": "b2700000-0000-0000-0000-0000000000ff"}]')->>'error',
  'ESPECIE_INEXISTENTE', 'una especie inexistente se rechaza');
select is((select count(*)::int from especies_27
  where plantation_id = 'b2700000-0000-0000-0000-0000000000aa'), 2,
  'un rechazo no toca las especies');

select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000af', '[]')->>'error',
  'PLANTACION_FINALIZADA', 'admin no reemplaza especies de una finalizada');
select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000ac', '[]')->>'error',
  'PLANTACION_ARCHIVADA', 'nadie reemplaza especies de una archivada');
select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000ff', '[]')->>'error',
  'PLANTACION_INEXISTENTE', 'una plantación inexistente se informa como tal');
select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000bb', '[]')->>'error',
  'NOT_AUTHORIZED', 'admin no reemplaza especies de otra organización');
select is((select count(*)::int from especies_27 where plantation_id in (
  'b2700000-0000-0000-0000-0000000000af', 'b2700000-0000-0000-0000-0000000000ac',
  'b2700000-0000-0000-0000-0000000000bb')), 3,
  'los rechazos no borran especies');

select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000aa', null),
  '{"success": true}'::jsonb, 'una lista vacía deja la plantación sin especies');
select is((select count(*)::int from especies_27
  where plantation_id = 'b2700000-0000-0000-0000-0000000000aa'), 0,
  'sin especies después de la lista vacía');

select set_config('request.jwt.claim.sub', 'b2700000-0000-0000-0000-0000000000a2', true);
select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000af',
  '[{"species_id": "b2700000-0000-0000-0000-000000000052", "orden_visual": 0}]'),
  '{"success": true}'::jsonb, 'superadmin reemplaza especies de una finalizada');
select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000ac', '[]')->>'error',
  'PLANTACION_ARCHIVADA', 'superadmin tampoco en una archivada');

select set_config('request.jwt.claim.sub', 'b2700000-0000-0000-0000-0000000000a3', true);
select is(reemplazar_especies_plantacion('b2700000-0000-0000-0000-0000000000aa', '[]')->>'error',
  'NOT_AUTHORIZED', 'un técnico no reemplaza especies');

-- ── Técnicos ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2700000-0000-0000-0000-0000000000a1', true);

select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000aa',
  array['b2700000-0000-0000-0000-0000000000a4', 'b2700000-0000-0000-0000-0000000000a1']::uuid[]),
  '{"success": true}'::jsonb, 'admin reemplaza los técnicos de una activa');
select is((select string_agg(user_id::text || ':' || rol_en_plantacion, ',' order by user_id)
  from asignaciones_27 where plantation_id = 'b2700000-0000-0000-0000-0000000000aa'),
  'b2700000-0000-0000-0000-0000000000a1:admin,b2700000-0000-0000-0000-0000000000a2:admin,'
  || 'b2700000-0000-0000-0000-0000000000a4:tecnico,b2700000-0000-0000-0000-0000000000a5:tecnico',
  'sale el técnico quitado; quedan el nuevo, las membresías admin y el técnico inactivo');

select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000aa',
  array['b2700000-0000-0000-0000-0000000000b3']::uuid[])->>'error',
  'USUARIO_DE_OTRA_ORGANIZACION', 'no se asigna un usuario de otra organización');
select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000aa',
  array['b2700000-0000-0000-0000-0000000000ff']::uuid[])->>'error',
  'USUARIO_DE_OTRA_ORGANIZACION', 'ni un usuario inexistente');
select is((select count(*)::int from asignaciones_27
  where plantation_id = 'b2700000-0000-0000-0000-0000000000aa'
    and user_id = 'b2700000-0000-0000-0000-0000000000a4'), 1,
  'un rechazo no quita técnicos');

select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000af',
  array['b2700000-0000-0000-0000-0000000000a4']::uuid[]),
  '{"success": true}'::jsonb, 'una finalizada admite asignaciones');
select is((select string_agg(user_id::text, ',' order by user_id) from asignaciones_27
  where plantation_id = 'b2700000-0000-0000-0000-0000000000af' and rol_en_plantacion = 'tecnico'),
  'b2700000-0000-0000-0000-0000000000a4', 'la finalizada queda con el técnico nuevo');

select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000ac', '{}')->>'error',
  'PLANTACION_ARCHIVADA', 'una archivada no admite asignaciones');
select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000ff', '{}')->>'error',
  'PLANTACION_INEXISTENTE', 'asignar en una inexistente se informa como tal');
select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000bb', '{}')->>'error',
  'NOT_AUTHORIZED', 'admin no reemplaza técnicos de otra organización');
select is((select count(*)::int from asignaciones_27
  where rol_en_plantacion = 'tecnico' and plantation_id in (
    'b2700000-0000-0000-0000-0000000000ac', 'b2700000-0000-0000-0000-0000000000bb')), 2,
  'los rechazos no quitan técnicos');

select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000aa', null),
  '{"success": true}'::jsonb, 'una lista vacía quita los técnicos activos');
select is((select string_agg(user_id::text || ':' || rol_en_plantacion, ',' order by user_id)
  from asignaciones_27 where plantation_id = 'b2700000-0000-0000-0000-0000000000aa'),
  'b2700000-0000-0000-0000-0000000000a1:admin,b2700000-0000-0000-0000-0000000000a2:admin,'
  || 'b2700000-0000-0000-0000-0000000000a5:tecnico',
  'con la lista vacía quedan las membresías admin y el inactivo');

select set_config('request.jwt.claim.sub', 'b2700000-0000-0000-0000-0000000000a3', true);
select is(reemplazar_tecnicos_plantacion('b2700000-0000-0000-0000-0000000000af', '{}')->>'error',
  'NOT_AUTHORIZED', 'un técnico no reemplaza técnicos');

-- ── Privilegios ──────────────────────────────────────────────────────────────
reset role;
select is(has_function_privilege('anon', 'public.reemplazar_especies_plantacion(uuid, jsonb)', 'execute'),
  false, 'anon no ejecuta reemplazar_especies_plantacion');
select is(has_function_privilege('anon', 'public.reemplazar_tecnicos_plantacion(uuid, uuid[])', 'execute'),
  false, 'anon no ejecuta reemplazar_tecnicos_plantacion');
select is(has_function_privilege('authenticated', 'public.rechazo_configuracion_plantacion(uuid, boolean)', 'execute'),
  false, 'el gate común no se expone');
select is(has_function_privilege('authenticated', 'public.reemplazar_tecnicos_plantacion(uuid, uuid[])', 'execute'),
  true, 'authenticated ejecuta los RPC');

select * from finish();
rollback;
