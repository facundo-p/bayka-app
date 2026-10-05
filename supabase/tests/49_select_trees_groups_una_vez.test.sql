-- SELECT de trees y groups con `mis_plantaciones()` y el RPC `catalogo_conteos`
-- (067, #682). Cada rol ve las mismas filas que con `is_plantation_member()`:
-- técnico miembro y no miembro, admin propio y de otra organización, perfil
-- inactivo. Los tests 10 y 23 cubren los mismos casos por fila.
begin;
select plan(22);

insert into organizations (id, nombre) values
  ('b4900000-0000-0000-0000-000000000001', 'Org1 Test 49'),
  ('b4900000-0000-0000-0000-000000000002', 'Org2 Test 49');

insert into auth.users (id, email) values
  ('b4900000-0000-0000-0000-0000000000a1', 'admin1-49@test.local'),
  ('b4900000-0000-0000-0000-0000000000a2', 'admin2-49@test.local'),
  ('b4900000-0000-0000-0000-0000000000a3', 'tecnico-49@test.local'),
  ('b4900000-0000-0000-0000-0000000000a4', 'sin-membresia-49@test.local'),
  ('b4900000-0000-0000-0000-0000000000a5', 'tecnico-inactivo-49@test.local');

update profiles set organizacion_id = 'b4900000-0000-0000-0000-000000000001'
  where id::text like 'b4900000-%' and id <> 'b4900000-0000-0000-0000-0000000000a2';
update profiles set organizacion_id = 'b4900000-0000-0000-0000-000000000002'
  where id = 'b4900000-0000-0000-0000-0000000000a2';
update profiles set rol = 'admin'
  where id in ('b4900000-0000-0000-0000-0000000000a1', 'b4900000-0000-0000-0000-0000000000a2');

-- P1 y P3 en org1, P2 en org2. El trigger suma a cada admin a las de su org.
select tests.crear_plantacion('b4900000-0000-0000-0000-000000000010', 'b4900000-0000-0000-0000-000000000001',
  'b4900000-0000-0000-0000-0000000000a1', 'P1 49');
select tests.crear_plantacion('b4900000-0000-0000-0000-000000000020', 'b4900000-0000-0000-0000-000000000002',
  'b4900000-0000-0000-0000-0000000000a2', 'P2 49');
select tests.crear_plantacion('b4900000-0000-0000-0000-000000000030', 'b4900000-0000-0000-0000-000000000001',
  'b4900000-0000-0000-0000-0000000000a1', 'P3 49 sin grupos');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b4900000-0000-0000-0000-000000000010', 'b4900000-0000-0000-0000-0000000000a3', 'tecnico'),
  ('b4900000-0000-0000-0000-000000000030', 'b4900000-0000-0000-0000-0000000000a3', 'tecnico'),
  ('b4900000-0000-0000-0000-000000000010', 'b4900000-0000-0000-0000-0000000000a5', 'tecnico');
update profiles set activo = false where id = 'b4900000-0000-0000-0000-0000000000a5';

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b4900000-0000-0000-0000-000000000011', 'b4900000-0000-0000-0000-000000000010', 'Parcela P1', 'PA1'),
  ('b4900000-0000-0000-0000-000000000021', 'b4900000-0000-0000-0000-000000000020', 'Parcela P2', 'PA2');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b4900000-0000-0000-0000-000000000012', 'b4900000-0000-0000-0000-000000000010',
   'b4900000-0000-0000-0000-000000000011', 'G1', 'G1', 'linea', 'b4900000-0000-0000-0000-0000000000a1'),
  ('b4900000-0000-0000-0000-000000000013', 'b4900000-0000-0000-0000-000000000010',
   'b4900000-0000-0000-0000-000000000011', 'G2', 'G2', 'linea', 'b4900000-0000-0000-0000-0000000000a1'),
  ('b4900000-0000-0000-0000-000000000022', 'b4900000-0000-0000-0000-000000000020',
   'b4900000-0000-0000-0000-000000000021', 'G3', 'G3', 'linea', 'b4900000-0000-0000-0000-0000000000a2');

-- P1: 3 árboles en G1, G2 vacío. P2: 1 árbol.
insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('b4900000-0000-0000-0000-000000000101', 'b4900000-0000-0000-0000-000000000012', 1, 'A1',
   'b4900000-0000-0000-0000-0000000000a1'),
  ('b4900000-0000-0000-0000-000000000102', 'b4900000-0000-0000-0000-000000000012', 2, 'A2',
   'b4900000-0000-0000-0000-0000000000a1'),
  ('b4900000-0000-0000-0000-000000000103', 'b4900000-0000-0000-0000-000000000012', 3, 'A3',
   'b4900000-0000-0000-0000-0000000000a1'),
  ('b4900000-0000-0000-0000-000000000201', 'b4900000-0000-0000-0000-000000000022', 1, 'A1',
   'b4900000-0000-0000-0000-0000000000a2');

create temp table ids_49 (ids uuid[]);
insert into ids_49 values (array[
  'b4900000-0000-0000-0000-000000000010',
  'b4900000-0000-0000-0000-000000000020',
  'b4900000-0000-0000-0000-000000000030']::uuid[]);
grant select on ids_49 to authenticated;

-- Plan de una consulta en texto, para ver cuántas veces se evalúa la policy.
create function pg_temp.plan_49(p_sql text) returns text language plpgsql as $$
declare
  v_linea text;
  v_plan text := '';
begin
  for v_linea in execute 'explain (costs off) ' || p_sql loop
    v_plan := v_plan || v_linea || E'\n';
  end loop;
  return v_plan;
end;
$$;

set local role authenticated;

-- ── Técnico miembro de P1 y P3 ──────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b4900000-0000-0000-0000-0000000000a3', true);
select is((select array(select unnest(mis_plantaciones()) order by 1)),
  array['b4900000-0000-0000-0000-000000000010', 'b4900000-0000-0000-0000-000000000030']::uuid[],
  'mis_plantaciones del técnico: P1 y P3');
select is((select count(*)::int from groups where id::text like 'b4900000-%'), 2,
  'El técnico ve los 2 grupos de P1');
select is((select count(*)::int from trees where id::text like 'b4900000-%'), 3,
  'El técnico ve los 3 árboles de P1, ninguno de P2');
select results_eq(
  $$ select plantation_id, grupos, arboles from catalogo_conteos((select ids from ids_49)) $$,
  $$ values ('b4900000-0000-0000-0000-000000000010'::uuid, 2::bigint, 3::bigint) $$,
  'catalogo_conteos del técnico: P1 con 2 grupos (uno vacío) y 3 árboles; P2 ajena y P3 sin grupos no aparecen');
select matches(pg_temp.plan_49('select group_id from trees'), 'InitPlan',
  'La policy de trees calcula mis_plantaciones una vez por query (InitPlan), no por fila');
select matches(pg_temp.plan_49('select id from groups'), 'InitPlan',
  'La policy de groups calcula mis_plantaciones una vez por query (InitPlan), no por fila');

-- ── Usuario sin membresía ───────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b4900000-0000-0000-0000-0000000000a4', true);
select is(mis_plantaciones(), '{}'::uuid[], 'mis_plantaciones sin membresía: vacío');
select is((select count(*)::int from groups where id::text like 'b4900000-%'), 0,
  'Sin membresía no ve grupos');
select is((select count(*)::int from trees where id::text like 'b4900000-%'), 0,
  'Sin membresía no ve árboles');
select is_empty($$ select * from catalogo_conteos((select ids from ids_49)) $$,
  'catalogo_conteos sin membresía: vacío');

-- ── Técnico inactivo, miembro de P1 ─────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b4900000-0000-0000-0000-0000000000a5', true);
select is(mis_plantaciones(), '{}'::uuid[], 'mis_plantaciones de un perfil inactivo: vacío');
select is((select count(*)::int from trees where id::text like 'b4900000-%'), 0,
  'Un perfil inactivo no ve árboles de su plantación');
select is((select count(*)::int from groups where id::text like 'b4900000-%'), 0,
  'Un perfil inactivo no ve grupos de su plantación');

-- ── Admin de org1: miembro de P1 y P3 por trigger ───────────────────────────
select set_config('request.jwt.claim.sub', 'b4900000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from trees where id::text like 'b4900000-%'), 3,
  'El admin de org1 ve los árboles de P1, ninguno de P2');
select is((select count(*)::int from groups where plantation_id = 'b4900000-0000-0000-0000-000000000020'), 0,
  'El admin de org1 no ve grupos de org2');
select results_eq(
  $$ select plantation_id, grupos, arboles from catalogo_conteos((select ids from ids_49)) $$,
  $$ values ('b4900000-0000-0000-0000-000000000010'::uuid, 2::bigint, 3::bigint) $$,
  'catalogo_conteos del admin de org1: solo P1');

-- ── Admin de org2 ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b4900000-0000-0000-0000-0000000000a2', true);
select is((select count(*)::int from trees where id::text like 'b4900000-%'), 1,
  'El admin de org2 ve solo el árbol de P2');
select results_eq(
  $$ select plantation_id, grupos, arboles from catalogo_conteos((select ids from ids_49)) $$,
  $$ values ('b4900000-0000-0000-0000-000000000020'::uuid, 1::bigint, 1::bigint) $$,
  'catalogo_conteos del admin de org2: solo P2');

reset role;

-- ── Grants e índices ────────────────────────────────────────────────────────
select ok(not has_function_privilege('anon', 'public.catalogo_conteos(uuid[])', 'execute'),
  'anon no ejecuta catalogo_conteos');
select ok(not has_function_privilege('anon', 'public.mis_plantaciones()', 'execute'),
  'anon no ejecuta mis_plantaciones');
select has_index('public', 'trees', 'trees_created_at_idx', 'Índice de trees por created_at');
select has_index('public', 'trees', 'trees_species_id_idx', 'Índice de trees por species_id');

select * from finish();
rollback;
