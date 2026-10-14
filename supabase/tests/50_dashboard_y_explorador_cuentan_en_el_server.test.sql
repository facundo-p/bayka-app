-- RPCs `dashboard_arboles` y `arboles_por_grupo` (068, #684): cuentan solo lo
-- que el usuario puede leer, agrupan por mes en UTC, no cuentan fotos locales
-- y listan los grupos vacíos.
begin;
select plan(14);

insert into organizations (id, nombre) values
  ('b5000000-0000-0000-0000-000000000001', 'Org1 Test 50'),
  ('b5000000-0000-0000-0000-000000000002', 'Org2 Test 50');

insert into auth.users (id, email) values
  ('b5000000-0000-0000-0000-0000000000a1', 'admin1-50@test.local'),
  ('b5000000-0000-0000-0000-0000000000a2', 'admin2-50@test.local'),
  ('b5000000-0000-0000-0000-0000000000a3', 'tecnico-50@test.local'),
  ('b5000000-0000-0000-0000-0000000000a4', 'sin-membresia-50@test.local');

update profiles set organizacion_id = 'b5000000-0000-0000-0000-000000000001'
  where id::text like 'b5000000-%' and id <> 'b5000000-0000-0000-0000-0000000000a2';
update profiles set organizacion_id = 'b5000000-0000-0000-0000-000000000002'
  where id = 'b5000000-0000-0000-0000-0000000000a2';
update profiles set rol = 'admin'
  where id in ('b5000000-0000-0000-0000-0000000000a1', 'b5000000-0000-0000-0000-0000000000a2');

select tests.crear_plantacion('b5000000-0000-0000-0000-000000000010', 'b5000000-0000-0000-0000-000000000001',
  'b5000000-0000-0000-0000-0000000000a1', 'P1 50');
select tests.crear_plantacion('b5000000-0000-0000-0000-000000000020', 'b5000000-0000-0000-0000-000000000002',
  'b5000000-0000-0000-0000-0000000000a2', 'P2 50');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b5000000-0000-0000-0000-000000000010', 'b5000000-0000-0000-0000-0000000000a3', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5000000-0000-0000-0000-000000000011', 'b5000000-0000-0000-0000-000000000010', 'Parcela P1', 'PA1'),
  ('b5000000-0000-0000-0000-000000000021', 'b5000000-0000-0000-0000-000000000020', 'Parcela P2', 'PA2');

insert into species (id, codigo, nombre) values
  ('b5000000-0000-0000-0000-0000000000e1', 'E50', 'Especie 50');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b5000000-0000-0000-0000-000000000012', 'b5000000-0000-0000-0000-000000000010',
   'b5000000-0000-0000-0000-000000000011', 'G1', 'G1', 'linea', 'b5000000-0000-0000-0000-0000000000a1'),
  ('b5000000-0000-0000-0000-000000000013', 'b5000000-0000-0000-0000-000000000010',
   'b5000000-0000-0000-0000-000000000011', 'G2 vacío', 'G2', 'linea', 'b5000000-0000-0000-0000-0000000000a1'),
  ('b5000000-0000-0000-0000-000000000022', 'b5000000-0000-0000-0000-000000000020',
   'b5000000-0000-0000-0000-000000000021', 'G3', 'G3', 'linea', 'b5000000-0000-0000-0000-0000000000a2');

-- P1, todos en G1:
--   A1, A2: con especie, GPS y foto subida, junio → una fila con cantidad 2.
--   A3, A4: N/N, fotos locales (file://, content://), 23:30 del 31/5 en -03,
--           que en UTC ya es junio → una fila con cantidad 2.
--   A5: con especie, foto vacía, mayo.
-- P2: un árbol en G3.
insert into trees (id, group_id, posicion, sub_id, usuario_registro, species_id,
                   latitude, longitude, foto_url, created_at) values
  ('b5000000-0000-0000-0000-000000000101', 'b5000000-0000-0000-0000-000000000012', 1, 'A1',
   'b5000000-0000-0000-0000-0000000000a1', 'b5000000-0000-0000-0000-0000000000e1',
   -27.1, -55.2, 'plantations/p1/trees/a1.jpg', '2026-06-03T12:00:00Z'),
  ('b5000000-0000-0000-0000-000000000102', 'b5000000-0000-0000-0000-000000000012', 2, 'A2',
   'b5000000-0000-0000-0000-0000000000a1', 'b5000000-0000-0000-0000-0000000000e1',
   -27.1, -55.2, 'plantations/p1/trees/a2.jpg', '2026-06-04T12:00:00Z'),
  ('b5000000-0000-0000-0000-000000000103', 'b5000000-0000-0000-0000-000000000012', 3, 'A3',
   'b5000000-0000-0000-0000-0000000000a1', null,
   null, null, 'file:///data/a3.jpg', '2026-05-31T23:30:00-03:00'),
  ('b5000000-0000-0000-0000-000000000104', 'b5000000-0000-0000-0000-000000000012', 4, 'A4',
   'b5000000-0000-0000-0000-0000000000a1', null,
   null, null, 'content://media/a4', '2026-05-31T23:30:00-03:00'),
  ('b5000000-0000-0000-0000-000000000105', 'b5000000-0000-0000-0000-000000000012', 5, 'A5',
   'b5000000-0000-0000-0000-0000000000a1', 'b5000000-0000-0000-0000-0000000000e1',
   null, null, '', '2026-05-15T12:00:00Z'),
  ('b5000000-0000-0000-0000-000000000201', 'b5000000-0000-0000-0000-000000000022', 1, 'A1',
   'b5000000-0000-0000-0000-0000000000a2', null,
   null, null, null, '2026-06-01T12:00:00Z');

-- Filas del jsonb del dashboard como tabla, para comparar sin depender del orden.
create function pg_temp.dashboard_50(p_plantation_id uuid)
returns table (parcela_id uuid, species_id uuid, mes text, con_gps boolean, con_foto boolean, cantidad int)
language sql as $$
  select * from jsonb_to_recordset(dashboard_arboles(p_plantation_id))
    as x(parcela_id uuid, species_id uuid, mes text, con_gps boolean, con_foto boolean, cantidad int)
$$;

create function pg_temp.grupos_50(p_plantation_id uuid)
returns table (group_id uuid, parcela_id uuid, arboles int)
language sql as $$
  select * from jsonb_to_recordset(arboles_por_grupo(p_plantation_id))
    as x(group_id uuid, parcela_id uuid, arboles int)
$$;

set local role authenticated;

-- ── Técnico miembro de P1 ───────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b5000000-0000-0000-0000-0000000000a3', true);
select set_eq(
  $$ select * from pg_temp.dashboard_50('b5000000-0000-0000-0000-000000000010') $$,
  $$ values
    ('b5000000-0000-0000-0000-000000000011'::uuid, 'b5000000-0000-0000-0000-0000000000e1'::uuid,
     '2026-06', true, true, 2),
    ('b5000000-0000-0000-0000-000000000011'::uuid, null::uuid, '2026-06', false, false, 2),
    ('b5000000-0000-0000-0000-000000000011'::uuid, 'b5000000-0000-0000-0000-0000000000e1'::uuid,
     '2026-05', false, false, 1) $$,
  'dashboard_arboles agrupa por especie, mes en UTC, GPS y foto; las fotos locales y vacías no cuentan');
select set_eq(
  $$ select * from pg_temp.grupos_50('b5000000-0000-0000-0000-000000000010') $$,
  $$ values
    ('b5000000-0000-0000-0000-000000000012'::uuid, 'b5000000-0000-0000-0000-000000000011'::uuid, 5),
    ('b5000000-0000-0000-0000-000000000013'::uuid, 'b5000000-0000-0000-0000-000000000011'::uuid, 0) $$,
  'arboles_por_grupo incluye el grupo vacío con 0');
select is(dashboard_arboles('b5000000-0000-0000-0000-000000000020'), '[]'::jsonb,
  'El técnico no cuenta árboles de una plantación ajena');
select is(arboles_por_grupo('b5000000-0000-0000-0000-000000000020'), '[]'::jsonb,
  'El técnico no ve grupos de una plantación ajena');

-- ── Usuario sin membresía ───────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b5000000-0000-0000-0000-0000000000a4', true);
select is(dashboard_arboles('b5000000-0000-0000-0000-000000000010'), '[]'::jsonb,
  'Sin membresía, dashboard_arboles devuelve []');
select is(arboles_por_grupo('b5000000-0000-0000-0000-000000000010'), '[]'::jsonb,
  'Sin membresía, arboles_por_grupo devuelve []');

-- ── Admin de org2 ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b5000000-0000-0000-0000-0000000000a2', true);
select set_eq(
  $$ select * from pg_temp.dashboard_50('b5000000-0000-0000-0000-000000000020') $$,
  $$ values ('b5000000-0000-0000-0000-000000000021'::uuid, null::uuid, '2026-06', false, false, 1) $$,
  'dashboard_arboles del admin de org2 en su plantación');
select is(dashboard_arboles('b5000000-0000-0000-0000-000000000010'), '[]'::jsonb,
  'El admin de org2 no cuenta árboles de org1');

reset role;

-- ── Seguridad ───────────────────────────────────────────────────────────────
select ok(not (select prosecdef from pg_proc where oid = 'public.dashboard_arboles(uuid)'::regprocedure),
  'dashboard_arboles es SECURITY INVOKER: respeta la RLS');
select ok(not (select prosecdef from pg_proc where oid = 'public.arboles_por_grupo(uuid)'::regprocedure),
  'arboles_por_grupo es SECURITY INVOKER: respeta la RLS');
select ok(not has_function_privilege('anon', 'public.dashboard_arboles(uuid)', 'execute'),
  'anon no ejecuta dashboard_arboles');
select ok(not has_function_privilege('anon', 'public.arboles_por_grupo(uuid)', 'execute'),
  'anon no ejecuta arboles_por_grupo');
select ok(has_function_privilege('authenticated', 'public.dashboard_arboles(uuid)', 'execute'),
  'authenticated ejecuta dashboard_arboles');
select ok(has_function_privilege('authenticated', 'public.arboles_por_grupo(uuid)', 'execute'),
  'authenticated ejecuta arboles_por_grupo');

select * from finish();
rollback;
