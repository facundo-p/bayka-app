-- SELECT scoped por membresía/organización (033, #310): profiles/organizations
-- por organizacion_id, plantations/parcelas/groups/trees/plantation_species/
-- plantation_users por plantation_users, storage.objects de tree-photos por
-- plantación, triggers de membresía admin acotados a la organización.
begin;
select plan(37);

-- org1 usa el UUID hardcodeado que handle_new_user busca (ver baseline): todo
-- auth.users nuevo cae ahí por default. org2 es una segunda organización para
-- probar el aislamiento cross-org.
insert into organizations (id, nombre) values
  ('00000000-0000-0000-0000-000000000001', 'Org1 Test 10'),
  ('10000000-0000-0000-0000-000000000001', 'Org2 Test 10');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-0000000000b1', 't1-10@test.local'),
  ('10000000-0000-0000-0000-0000000000b2', 't2-10@test.local'),
  ('10000000-0000-0000-0000-0000000000b3', 'a1-10@test.local'),
  ('10000000-0000-0000-0000-0000000000b4', 'u2-10@test.local');
-- trg_handle_new_user les asignó organizacion_id = org1 (rol tecnico) a los 4.

update profiles set organizacion_id = '10000000-0000-0000-0000-000000000001'
  where id = '10000000-0000-0000-0000-0000000000b4';
update profiles set rol = 'admin' where id = '10000000-0000-0000-0000-0000000000b3';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'P1 org1', '2026', '10000000-0000-0000-0000-0000000000b3');
-- trg_add_admin_memberships (033): A1 es admin de org1 = org de P1 -> se suma solo.

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001',
   'P2 org2', '2026', '10000000-0000-0000-0000-0000000000b4');
-- A1 es de org1 != org de P2: NO se suma a P2.

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-0000000000b1', 'tecnico');
-- T1 es miembro de P1. T2 queda deliberadamente sin membresía en ninguna.

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000010', 'Parcela P1', 'PC1'),
  ('10000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000020', 'Parcela P2', 'PC2');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('10000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000010',
   '10000000-0000-0000-0000-000000000011', 'G1', 'G1', 'linea', '10000000-0000-0000-0000-0000000000b3'),
  ('10000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000020',
   '10000000-0000-0000-0000-000000000021', 'G2', 'G2', 'linea', '10000000-0000-0000-0000-0000000000b4');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('10000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000012', 1, 'A1',
   '10000000-0000-0000-0000-0000000000b3'),
  ('10000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000022', 1, 'A1',
   '10000000-0000-0000-0000-0000000000b4');

insert into species (id, codigo, nombre) values
  ('10000000-0000-0000-0000-000000000099', 'SP10', 'Especie Test 10');

insert into plantation_species (plantation_id, species_id) values
  ('10000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000099'),
  ('10000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000099');

-- ── T1: ve las 6 entidades de P1, ninguna de P2 ─────────────────────────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b1', true);

select is((select count(*)::int from plantations where id = '10000000-0000-0000-0000-000000000010'),
  1, 'T1 ve la plantación P1');
select is((select count(*)::int from plantations where id = '10000000-0000-0000-0000-000000000020'),
  0, 'T1 no ve la plantación P2');
select is((select count(*)::int from parcelas where id = '10000000-0000-0000-0000-000000000011'),
  1, 'T1 ve la parcela de P1');
select is((select count(*)::int from parcelas where id = '10000000-0000-0000-0000-000000000021'),
  0, 'T1 no ve la parcela de P2');
select is((select count(*)::int from groups where id = '10000000-0000-0000-0000-000000000012'),
  1, 'T1 ve el grupo de P1');
select is((select count(*)::int from groups where id = '10000000-0000-0000-0000-000000000022'),
  0, 'T1 no ve el grupo de P2');
select is((select count(*)::int from trees where id = '10000000-0000-0000-0000-000000000013'),
  1, 'T1 ve el árbol de P1');
select is((select count(*)::int from trees where id = '10000000-0000-0000-0000-000000000023'),
  0, 'T1 no ve el árbol de P2');
select is((select count(*)::int from plantation_species where plantation_id = '10000000-0000-0000-0000-000000000010'),
  1, 'T1 ve plantation_species de P1');
select is((select count(*)::int from plantation_species where plantation_id = '10000000-0000-0000-0000-000000000020'),
  0, 'T1 no ve plantation_species de P2');
select is((select count(*)::int from plantation_users where plantation_id = '10000000-0000-0000-0000-000000000010'),
  2, 'T1 ve plantation_users de P1 (él mismo + A1 por trigger)');
select is((select count(*)::int from plantation_users where plantation_id = '10000000-0000-0000-0000-000000000020'),
  0, 'T1 no ve plantation_users de P2');

-- ── T2: no miembro de nada, no ve ninguna de las 6 entidades de P1 ─────────
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b2', true);
select is(
  ( select
      (select count(*)::int from plantations where id = '10000000-0000-0000-0000-000000000010')
    + (select count(*)::int from parcelas where plantation_id = '10000000-0000-0000-0000-000000000010')
    + (select count(*)::int from groups where plantation_id = '10000000-0000-0000-0000-000000000010')
    + (select count(*)::int from trees where id = '10000000-0000-0000-0000-000000000013')
    + (select count(*)::int from plantation_species where plantation_id = '10000000-0000-0000-0000-000000000010')
    + (select count(*)::int from plantation_users where plantation_id = '10000000-0000-0000-0000-000000000010')
  ),
  0,
  'T2 (no miembro) no ve ninguna de las 6 entidades scoped de P1'
);

-- ── U2 (org2): no ve profiles ni la organización de org1 ───────────────────
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b4', true);
select is((select count(*)::int from profiles where organizacion_id = '00000000-0000-0000-0000-000000000001'),
  0, 'U2 (org2) no ve profiles de org1');
select is((select count(*)::int from organizations where id = '00000000-0000-0000-0000-000000000001'),
  0, 'U2 (org2) no ve la fila de organizations de org1');

-- ── Cada quien ve su propio profile, sin importar organización/membresía ──
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b1', true);
select is((select count(*)::int from profiles where id = '10000000-0000-0000-0000-0000000000b1'),
  1, 'T1 ve su propio profile');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b2', true);
select is((select count(*)::int from profiles where id = '10000000-0000-0000-0000-0000000000b2'),
  1, 'T2 ve su propio profile');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b3', true);
select is((select count(*)::int from profiles where id = '10000000-0000-0000-0000-0000000000b3'),
  1, 'A1 ve su propio profile');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b4', true);
select is((select count(*)::int from profiles where id = '10000000-0000-0000-0000-0000000000b4'),
  1, 'U2 ve su propio profile');

reset role;

-- ── A1: auto-miembro de P1 (misma org) por trigger, no de P2 (otra org) ────
select is(
  (select count(*)::int from plantation_users
    where plantation_id = '10000000-0000-0000-0000-000000000010' and user_id = '10000000-0000-0000-0000-0000000000b3'),
  1, 'A1 quedó auto-agregado como miembro de P1 (misma organización)'
);
select is(
  (select count(*)::int from plantation_users
    where plantation_id = '10000000-0000-0000-0000-000000000020' and user_id = '10000000-0000-0000-0000-0000000000b3'),
  0, 'A1 NO quedó agregado a P2 (organización distinta)'
);

-- ── stats_plantaciones(): scoped por is_plantation_member() vía RLS ────────
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b1', true);
select is(
  (select array_agg(plantation_id) from stats_plantaciones()),
  ARRAY['10000000-0000-0000-0000-000000000010'::uuid],
  'stats_plantaciones() devuelve solo P1 para T1'
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b2', true);
select is(
  (select count(*)::int from stats_plantaciones()),
  0, 'stats_plantaciones() no devuelve nada para T2 (sin membresías)'
);

-- ── plantation_ids_status() (032, SECURITY INVOKER): RLS lo filtra igual ──
select is(
  (select row(total, con_id, generados) from plantation_ids_status('10000000-0000-0000-0000-000000000010'::uuid)),
  row(0, 0, false),
  'plantation_ids_status de P1 da (0,0,false) para T2 (no miembro), pese a tener un árbol real'
);
reset role;
-- Limpia el jwt.claim seteado por el bloque anterior: protect_profile_fields
-- exige auth.uid() IS NULL (conexión "de servicio") o superadmin para tocar rol.
select set_config('request.jwt.claim.sub', '', true);

-- ── Promover a T2 a admin: membresía solo en plantaciones de su organización ──
update profiles set rol = 'admin' where id = '10000000-0000-0000-0000-0000000000b2';
select is(
  (select count(*)::int from plantation_users
    where plantation_id = '10000000-0000-0000-0000-000000000010' and user_id = '10000000-0000-0000-0000-0000000000b2'),
  1, 'promover a T2 (org1) a admin lo agrega como miembro de P1 (org1)'
);
select is(
  (select count(*)::int from plantation_users
    where plantation_id = '10000000-0000-0000-0000-000000000020' and user_id = '10000000-0000-0000-0000-0000000000b2'),
  0, 'promover a T2 a admin NO lo agrega a P2 (org2)'
);

-- ── storage.objects (tree-photos): scoped por plantación vía el path ──────
-- storage.protect_delete() (guard del stack, no de este PR) bloquea todo
-- DELETE directo por SQL salvo que se habilite explícitamente esta GUC.
set local storage.allow_delete_query = 'true';

-- Filas sembradas fuera de RLS (rol superuser), como haría un alta service_role.
insert into storage.buckets (id, name, public) values ('tree-photos', 'tree-photos', false)
  on conflict (id) do nothing;
insert into storage.objects (bucket_id, name) values
  ('tree-photos', 'plantations/10000000-0000-0000-0000-000000000010/parcelas/10000000-0000-0000-0000-000000000011/trees/10000000-0000-0000-0000-000000000013.jpg'),
  ('tree-photos', 'plantations/10000000-0000-0000-0000-000000000020/parcelas/10000000-0000-0000-0000-000000000021/trees/10000000-0000-0000-0000-000000000023.jpg'),
  ('tree-photos', 'plantations/not-a-uuid/parcelas/x/trees/y.jpg');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b1', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'tree-photos'),
  1, 'T1 solo ve la foto de P1 (ni la de P2 ni el path malformado)'
);

select lives_ok(
  $$ update storage.objects set metadata = '{"t":1}'::jsonb
     where bucket_id = 'tree-photos'
       and name like 'plantations/10000000-0000-0000-0000-000000000010%' $$,
  'el update de T1 sobre la foto de P1 no lanza excepción'
);
select is(
  (select metadata from storage.objects
    where bucket_id = 'tree-photos' and name like 'plantations/10000000-0000-0000-0000-000000000010%'),
  '{"t":1}'::jsonb,
  'el update de T1 sobre la foto de P1 se aplicó (es miembro)'
);

select lives_ok(
  $$ update storage.objects set metadata = '{"t":2}'::jsonb
     where bucket_id = 'tree-photos'
       and name like 'plantations/10000000-0000-0000-0000-000000000020%' $$,
  'el update de T1 sobre la foto de P2 no lanza excepción (RLS filtra, no rechaza)'
);
select is(
  (select metadata from storage.objects
    where bucket_id = 'tree-photos' and name like 'plantations/10000000-0000-0000-0000-000000000020%'),
  null,
  'el update de T1 sobre la foto de P2 no tuvo efecto (no es miembro)'
);

select lives_ok(
  $$ delete from storage.objects
     where bucket_id = 'tree-photos'
       and name like 'plantations/10000000-0000-0000-0000-000000000010%' $$,
  'el delete de T1 sobre la foto de P1 no lanza excepción (no es admin, RLS filtra)'
);
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'tree-photos' and name like 'plantations/10000000-0000-0000-0000-000000000010%'),
  1, 'T1 (miembro no admin) no pudo borrar la foto de P1'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b3', true);
select lives_ok(
  $$ delete from storage.objects
     where bucket_id = 'tree-photos'
       and name like 'plantations/10000000-0000-0000-0000-000000000010%' $$,
  'A1 (admin) puede borrar la foto de P1'
);
select is(
  (select count(*)::int from storage.objects
    where bucket_id = 'tree-photos' and name like 'plantations/10000000-0000-0000-0000-000000000010%'),
  0, 'la foto de P1 quedó borrada por A1'
);

select lives_ok(
  $$ delete from storage.objects
     where bucket_id = 'tree-photos' and name = 'plantations/not-a-uuid/parcelas/x/trees/y.jpg' $$,
  'el delete de A1 sobre el path malformado no lanza excepción'
);
reset role;
select is(
  (select count(*)::int from storage.objects where name = 'plantations/not-a-uuid/parcelas/x/trees/y.jpg'),
  1, 'el path malformado no se pudo borrar (fail-closed): ni un admin matchea el regex'
);

select * from finish();
rollback;
