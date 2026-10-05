-- `catalogo_conteos` con fotos y bytes por plantación (069, #685): suma el
-- tamaño que Storage guarda de cada objeto, resuelve las URLs completas viejas,
-- no cuenta fotos locales ni referencias sin objeto, no altera grupos ni árboles
-- y solo suma lo que el usuario puede leer.
begin;
select plan(9);

insert into organizations (id, nombre) values
  ('b5100000-0000-0000-0000-000000000001', 'Org1 Test 51'),
  ('b5100000-0000-0000-0000-000000000002', 'Org2 Test 51');

insert into auth.users (id, email) values
  ('b5100000-0000-0000-0000-0000000000a1', 'admin1-51@test.local'),
  ('b5100000-0000-0000-0000-0000000000a2', 'admin2-51@test.local'),
  ('b5100000-0000-0000-0000-0000000000a3', 'tecnico-51@test.local'),
  ('b5100000-0000-0000-0000-0000000000a4', 'sin-membresia-51@test.local');

update profiles set organizacion_id = 'b5100000-0000-0000-0000-000000000001'
  where id::text like 'b5100000-%' and id <> 'b5100000-0000-0000-0000-0000000000a2';
update profiles set organizacion_id = 'b5100000-0000-0000-0000-000000000002'
  where id = 'b5100000-0000-0000-0000-0000000000a2';
update profiles set rol = 'admin'
  where id in ('b5100000-0000-0000-0000-0000000000a1', 'b5100000-0000-0000-0000-0000000000a2');

-- P1 en org1, P2 en org2. El trigger suma a cada admin a las de su org.
select tests.crear_plantacion('b5100000-0000-0000-0000-000000000010', 'b5100000-0000-0000-0000-000000000001',
  'b5100000-0000-0000-0000-0000000000a1', 'P1 51');
select tests.crear_plantacion('b5100000-0000-0000-0000-000000000020', 'b5100000-0000-0000-0000-000000000002',
  'b5100000-0000-0000-0000-0000000000a2', 'P2 51');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b5100000-0000-0000-0000-000000000010', 'b5100000-0000-0000-0000-0000000000a3', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5100000-0000-0000-0000-000000000011', 'b5100000-0000-0000-0000-000000000010', 'Parcela P1', 'PA1'),
  ('b5100000-0000-0000-0000-000000000021', 'b5100000-0000-0000-0000-000000000020', 'Parcela P2', 'PA2');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b5100000-0000-0000-0000-000000000012', 'b5100000-0000-0000-0000-000000000010',
   'b5100000-0000-0000-0000-000000000011', 'G1', 'G1', 'linea', 'b5100000-0000-0000-0000-0000000000a1'),
  ('b5100000-0000-0000-0000-000000000013', 'b5100000-0000-0000-0000-000000000010',
   'b5100000-0000-0000-0000-000000000011', 'G2', 'G2', 'linea', 'b5100000-0000-0000-0000-0000000000a1'),
  ('b5100000-0000-0000-0000-000000000022', 'b5100000-0000-0000-0000-000000000020',
   'b5100000-0000-0000-0000-000000000021', 'G3', 'G3', 'linea', 'b5100000-0000-0000-0000-0000000000a2');

-- P1, G1: A1 path relativo (1000 B), A2 URL completa con token (2500 B), A3 URI
-- local, A4 path sin objeto, A5 sin foto, A6 path en la carpeta de P2 (que la
-- policy de Storage no deja leer a los miembros de P1), A7 objeto sin `size`
-- (foto con 0 bytes). G2 vacío.
-- P2: A1 con foto (7000 B).
insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url) values
  ('b5100000-0000-0000-0000-000000000101', 'b5100000-0000-0000-0000-000000000012', 1, 'A1',
   'b5100000-0000-0000-0000-0000000000a1',
   'plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/a1.jpg'),
  ('b5100000-0000-0000-0000-000000000102', 'b5100000-0000-0000-0000-000000000012', 2, 'A2',
   'b5100000-0000-0000-0000-0000000000a1',
   'https://x.supabase.co/storage/v1/object/sign/tree-photos/plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/a2.jpg?token=abc'),
  ('b5100000-0000-0000-0000-000000000103', 'b5100000-0000-0000-0000-000000000012', 3, 'A3',
   'b5100000-0000-0000-0000-0000000000a1', 'file:///data/user/0/bayka/files/a3.jpg'),
  ('b5100000-0000-0000-0000-000000000104', 'b5100000-0000-0000-0000-000000000012', 4, 'A4',
   'b5100000-0000-0000-0000-0000000000a1',
   'plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/a4.jpg'),
  ('b5100000-0000-0000-0000-000000000105', 'b5100000-0000-0000-0000-000000000012', 5, 'A5',
   'b5100000-0000-0000-0000-0000000000a1', null),
  ('b5100000-0000-0000-0000-000000000106', 'b5100000-0000-0000-0000-000000000012', 6, 'A6',
   'b5100000-0000-0000-0000-0000000000a1',
   'plantations/b5100000-0000-0000-0000-000000000020/parcelas/p/trees/ajena.jpg'),
  ('b5100000-0000-0000-0000-000000000107', 'b5100000-0000-0000-0000-000000000012', 7, 'A7',
   'b5100000-0000-0000-0000-0000000000a1',
   'plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/a7.jpg'),
  ('b5100000-0000-0000-0000-000000000201', 'b5100000-0000-0000-0000-000000000022', 1, 'A1',
   'b5100000-0000-0000-0000-0000000000a2',
   'plantations/b5100000-0000-0000-0000-000000000020/parcelas/p/trees/b1.jpg');

insert into storage.objects (bucket_id, name, metadata) values
  ('tree-photos', 'plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/a1.jpg',
   '{"size": 1000}'),
  ('tree-photos', 'plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/a2.jpg',
   '{"size": 2500}'),
  ('tree-photos', 'plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/a7.jpg',
   '{"mimetype": "image/jpeg"}'),
  ('tree-photos', 'plantations/b5100000-0000-0000-0000-000000000020/parcelas/p/trees/ajena.jpg',
   '{"size": 9999}'),
  ('tree-photos', 'plantations/b5100000-0000-0000-0000-000000000020/parcelas/p/trees/b1.jpg',
   '{"size": 7000}'),
  -- Objeto huérfano de P1: ningún árbol lo referencia, no se descarga.
  ('tree-photos', 'plantations/b5100000-0000-0000-0000-000000000010/parcelas/p/trees/huerfana.jpg',
   '{"size": 50000}');

create temp table ids_51 (ids uuid[]);
insert into ids_51 values (array[
  'b5100000-0000-0000-0000-000000000010',
  'b5100000-0000-0000-0000-000000000020']::uuid[]);
grant select on ids_51 to authenticated;

set local role authenticated;

-- ── Técnico miembro de P1 ───────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b5100000-0000-0000-0000-0000000000a3', true);
select results_eq(
  $$ select plantation_id, grupos, arboles from catalogo_conteos((select ids from ids_51)) $$,
  $$ values ('b5100000-0000-0000-0000-000000000010'::uuid, 2::bigint, 7::bigint) $$,
  'Las fotos no inflan grupos ni árboles: P1 con 2 grupos (uno vacío) y 7 árboles');
select results_eq(
  $$ select plantation_id, fotos, bytes_fotos from catalogo_conteos((select ids from ids_51)) $$,
  $$ values ('b5100000-0000-0000-0000-000000000010'::uuid, 3::bigint, 3500::bigint) $$,
  'Técnico: suma path relativo, URL con token y sin size (0 B); ni URI local, ni sin objeto, ni la de P2, ni la huérfana');

-- ── Admin de org1: miembro de P1 por trigger ────────────────────────────────
select set_config('request.jwt.claim.sub', 'b5100000-0000-0000-0000-0000000000a1', true);
select results_eq(
  $$ select plantation_id, fotos, bytes_fotos from catalogo_conteos((select ids from ids_51)) $$,
  $$ values ('b5100000-0000-0000-0000-000000000010'::uuid, 3::bigint, 3500::bigint) $$,
  'Admin de org1: mismas fotos de P1 y nada de P2');

-- ── Admin de org2 ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b5100000-0000-0000-0000-0000000000a2', true);
select results_eq(
  $$ select plantation_id, grupos, arboles, fotos, bytes_fotos from catalogo_conteos((select ids from ids_51)) $$,
  $$ values ('b5100000-0000-0000-0000-000000000020'::uuid, 1::bigint, 1::bigint, 1::bigint, 7000::bigint) $$,
  'Admin de org2: solo P2, con su foto');

-- ── Sin membresía ───────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b5100000-0000-0000-0000-0000000000a4', true);
select is_empty($$ select * from catalogo_conteos((select ids from ids_51)) $$,
  'Sin membresía: ni conteos ni peso de plantaciones ajenas');

reset role;

-- ── Sin fotos: cero, no null ────────────────────────────────────────────────
update trees set foto_url = null where id::text like 'b5100000-%';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b5100000-0000-0000-0000-0000000000a3', true);
select results_eq(
  $$ select fotos, bytes_fotos from catalogo_conteos((select ids from ids_51)) $$,
  $$ values (0::bigint, 0::bigint) $$,
  'Una plantación sin fotos devuelve 0 fotos y 0 bytes');
reset role;

-- ── Definición ──────────────────────────────────────────────────────────────
select is((select prosecdef from pg_proc where oid = 'public.catalogo_conteos(uuid[])'::regprocedure), false,
  'catalogo_conteos sigue siendo SECURITY INVOKER');
select ok(not has_function_privilege('anon', 'public.catalogo_conteos(uuid[])', 'execute'),
  'anon no ejecuta catalogo_conteos');
select ok(has_function_privilege('authenticated', 'public.catalogo_conteos(uuid[])', 'execute'),
  'authenticated ejecuta catalogo_conteos');

select * from finish();
rollback;
