-- RPC `stats_plantaciones` (078, #826): cuenta puntos GPS y fotos subidas,
-- lista solo a los técnicos y respeta la RLS del que llama.
begin;
select plan(16);

insert into organizations (id, nombre) values
  ('b6100000-0000-0000-0000-000000000001', 'Org1 Test 61'),
  ('b6100000-0000-0000-0000-000000000002', 'Org2 Test 61');

insert into auth.users (id, email) values
  ('b6100000-0000-0000-0000-0000000000a1', 'admin1-61@test.local'),
  ('b6100000-0000-0000-0000-0000000000a2', 'admin2-61@test.local'),
  ('b6100000-0000-0000-0000-0000000000b1', 'tecnico1-61@test.local'),
  ('b6100000-0000-0000-0000-0000000000b2', 'tecnico2-61@test.local');

update profiles set organizacion_id = 'b6100000-0000-0000-0000-000000000001'
  where id::text like 'b6100000-%' and id <> 'b6100000-0000-0000-0000-0000000000a2';
update profiles set organizacion_id = 'b6100000-0000-0000-0000-000000000002'
  where id = 'b6100000-0000-0000-0000-0000000000a2';
update profiles set rol = 'admin'
  where id in ('b6100000-0000-0000-0000-0000000000a1', 'b6100000-0000-0000-0000-0000000000a2');

-- A1 queda miembro automático (admin) de P1 y P2; A2, de P3.
select tests.crear_plantacion('b6100000-0000-0000-0000-000000000010', 'b6100000-0000-0000-0000-000000000001',
  'b6100000-0000-0000-0000-0000000000a1', 'P1 61');
select tests.crear_plantacion('b6100000-0000-0000-0000-000000000020', 'b6100000-0000-0000-0000-000000000001',
  'b6100000-0000-0000-0000-0000000000a1', 'P2 61');
select tests.crear_plantacion('b6100000-0000-0000-0000-000000000030', 'b6100000-0000-0000-0000-000000000002',
  'b6100000-0000-0000-0000-0000000000a2', 'P3 61');

-- T1 en P1 y P2; T2 solo en P2.
insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b6100000-0000-0000-0000-000000000010', 'b6100000-0000-0000-0000-0000000000b1', 'tecnico'),
  ('b6100000-0000-0000-0000-000000000020', 'b6100000-0000-0000-0000-0000000000b1', 'tecnico'),
  ('b6100000-0000-0000-0000-000000000020', 'b6100000-0000-0000-0000-0000000000b2', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b6100000-0000-0000-0000-000000000011', 'b6100000-0000-0000-0000-000000000010', 'Parcela P1', 'PA1'),
  ('b6100000-0000-0000-0000-000000000031', 'b6100000-0000-0000-0000-000000000030', 'Parcela P3', 'PA3');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b6100000-0000-0000-0000-000000000012', 'b6100000-0000-0000-0000-000000000010',
   'b6100000-0000-0000-0000-000000000011', 'G1', 'G1', 'linea', 'b6100000-0000-0000-0000-0000000000a1'),
  ('b6100000-0000-0000-0000-000000000032', 'b6100000-0000-0000-0000-000000000030',
   'b6100000-0000-0000-0000-000000000031', 'G3', 'G3', 'linea', 'b6100000-0000-0000-0000-0000000000a2');

-- P1: A1 con GPS y foto subida; A2 con GPS y foto local; A3 foto content://;
-- A4 foto vacía; A5 sin foto. → 5 árboles, 2 puntos GPS, 1 foto.
-- P3: un árbol con GPS y foto subida.
insert into trees (id, group_id, posicion, sub_id, usuario_registro, latitude, longitude, foto_url) values
  ('b6100000-0000-0000-0000-000000000101', 'b6100000-0000-0000-0000-000000000012', 1, 'A1',
   'b6100000-0000-0000-0000-0000000000a1', -27.1, -55.2, 'plantations/p1/trees/a1.jpg'),
  ('b6100000-0000-0000-0000-000000000102', 'b6100000-0000-0000-0000-000000000012', 2, 'A2',
   'b6100000-0000-0000-0000-0000000000a1', -27.1, -55.2, 'file:///data/a2.jpg'),
  ('b6100000-0000-0000-0000-000000000103', 'b6100000-0000-0000-0000-000000000012', 3, 'A3',
   'b6100000-0000-0000-0000-0000000000a1', null, null, 'content://media/a3'),
  ('b6100000-0000-0000-0000-000000000104', 'b6100000-0000-0000-0000-000000000012', 4, 'A4',
   'b6100000-0000-0000-0000-0000000000a1', null, null, ''),
  ('b6100000-0000-0000-0000-000000000105', 'b6100000-0000-0000-0000-000000000012', 5, 'A5',
   'b6100000-0000-0000-0000-0000000000a1', null, null, null),
  ('b6100000-0000-0000-0000-000000000301', 'b6100000-0000-0000-0000-000000000032', 1, 'A1',
   'b6100000-0000-0000-0000-0000000000a2', -27.1, -55.2, 'plantations/p3/trees/a1.jpg');

set local role authenticated;

-- ── Admin de org1: ve P1 y P2 ───────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b6100000-0000-0000-0000-0000000000a1', true);
select set_eq(
  $$ select plantation_id, arboles::int, parcelas::int, puntos_gps::int, fotos::int
     from stats_plantaciones() $$,
  $$ values
    ('b6100000-0000-0000-0000-000000000010'::uuid, 5, 1, 2, 1),
    ('b6100000-0000-0000-0000-000000000020'::uuid, 0, 0, 0, 0) $$,
  'Cuenta GPS por latitud y solo fotos subidas; las locales, vacías y nulas no');
select is(
  (select tecnicos from stats_plantaciones() where plantation_id = 'b6100000-0000-0000-0000-000000000010'),
  array['b6100000-0000-0000-0000-0000000000b1'::uuid],
  'tecnicos lista al técnico asignado y no al admin miembro automático');
select is(
  (select tecnicos from stats_plantaciones() where plantation_id = 'b6100000-0000-0000-0000-000000000020'),
  array['b6100000-0000-0000-0000-0000000000b1', 'b6100000-0000-0000-0000-0000000000b2']::uuid[],
  'tecnicos lista a todos los técnicos de la plantación');
select ok(
  not exists (select 1 from stats_plantaciones() where plantation_id = 'b6100000-0000-0000-0000-000000000030'),
  'El admin de org1 no ve la plantación de org2');

-- ── Técnico: solo sus plantaciones ──────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b6100000-0000-0000-0000-0000000000b2', true);
select is(
  (select array_agg(plantation_id) from stats_plantaciones()),
  array['b6100000-0000-0000-0000-000000000020'::uuid],
  'El técnico solo ve las plantaciones a las que está asignado');
select is(
  (select tecnicos from stats_plantaciones()),
  array['b6100000-0000-0000-0000-0000000000b1', 'b6100000-0000-0000-0000-0000000000b2']::uuid[],
  'El técnico ve a todos los técnicos de su plantación');

-- ── Admin de org2 ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b6100000-0000-0000-0000-0000000000a2', true);
select set_eq(
  $$ select plantation_id, arboles::int, puntos_gps::int, fotos::int, tecnicos
     from stats_plantaciones() $$,
  $$ values ('b6100000-0000-0000-0000-000000000030'::uuid, 1, 1, 1, '{}'::uuid[]) $$,
  'El admin de org2 ve solo su plantación, con tecnicos vacío si no hay asignados');

reset role;

-- ── foto_subida ─────────────────────────────────────────────────────────────
select ok(foto_subida('plantations/p1/trees/a1.jpg'), 'Un path del bucket es foto subida');
select ok(not foto_subida('file:///data/a.jpg'), 'file:// no es foto subida');
select ok(not foto_subida('content://media/a'), 'content:// no es foto subida');
select ok(not foto_subida('') and not foto_subida(null), 'Vacía y nula no son foto subida');

select is((select provolatile from pg_proc where oid = 'public.foto_subida(text)'::regprocedure),
  'i'::"char", 'foto_subida es IMMUTABLE');
select is((select proconfig from pg_proc where oid = 'public.foto_subida(text)'::regprocedure),
  null, 'foto_subida no fija search_path: así Postgres la inlinea');

-- ── Seguridad ───────────────────────────────────────────────────────────────
select ok(not (select prosecdef from pg_proc where oid = 'public.stats_plantaciones()'::regprocedure),
  'stats_plantaciones es SECURITY INVOKER: respeta la RLS');
select ok(not has_function_privilege('anon', 'public.stats_plantaciones()', 'execute'),
  'anon no ejecuta stats_plantaciones');
select ok(has_function_privilege('authenticated', 'public.stats_plantaciones()', 'execute'),
  'authenticated ejecuta stats_plantaciones');

select * from finish();
rollback;
