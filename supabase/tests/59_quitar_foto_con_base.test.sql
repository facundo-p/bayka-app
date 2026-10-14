-- Quitar una foto con base (076, #810): `quitar_fotos_arboles` no quita la foto
-- que cambió en el servidor desde que el móvil la vio, y la devuelve en
-- `conservados`. Sin base quita como antes (APK de prod). Los permisos de 072
-- siguen: un árbol ajeno o de una plantación finalizada no vuelve conservado.
begin;
select plan(23);

insert into organizations (id, nombre) values ('b5900000-0000-0000-0000-000000000001', 'Org Test 59');

-- tp: técnico creador del grupo. to: otro técnico. ad: admin.
insert into auth.users (id, email) values
  ('b5900000-0000-0000-0000-0000000000a1', 'tp-59@test.local'),
  ('b5900000-0000-0000-0000-0000000000a2', 'to-59@test.local'),
  ('b5900000-0000-0000-0000-0000000000a3', 'admin-59@test.local');
update profiles set organizacion_id = 'b5900000-0000-0000-0000-000000000001' where id::text like 'b5900000-%';
update profiles set rol = 'admin' where id = 'b5900000-0000-0000-0000-0000000000a3';

select tests.crear_plantacion('b5900000-0000-0000-0000-000000000002', 'b5900000-0000-0000-0000-000000000001',
  'b5900000-0000-0000-0000-0000000000a3', 'Activa 59');
select tests.crear_plantacion('b5900000-0000-0000-0000-000000000012', 'b5900000-0000-0000-0000-000000000001',
  'b5900000-0000-0000-0000-0000000000a3', 'Finalizada 59', p_estado => 'finalizada');
insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b5900000-0000-0000-0000-000000000002', 'b5900000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b5900000-0000-0000-0000-000000000002', 'b5900000-0000-0000-0000-0000000000a2', 'tecnico'),
  ('b5900000-0000-0000-0000-000000000012', 'b5900000-0000-0000-0000-0000000000a1', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5900000-0000-0000-0000-000000000003', 'b5900000-0000-0000-0000-000000000002', 'P59', 'P59'),
  ('b5900000-0000-0000-0000-000000000013', 'b5900000-0000-0000-0000-000000000012', 'P59b', 'P59b');
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b5900000-0000-0000-0000-000000000004', 'b5900000-0000-0000-0000-000000000002',
   'b5900000-0000-0000-0000-000000000003', 'G59', 'G59', 'linea', 'b5900000-0000-0000-0000-0000000000a1'),
  ('b5900000-0000-0000-0000-000000000014', 'b5900000-0000-0000-0000-000000000012',
   'b5900000-0000-0000-0000-000000000013', 'G59b', 'G59b', 'linea', 'b5900000-0000-0000-0000-0000000000a1');

-- d1..d6 en el grupo activo, con la foto nueva (v2); d9 en la plantación finalizada.
insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url)
select ('b5900000-0000-0000-0000-0000000000d' || n)::uuid, 'b5900000-0000-0000-0000-000000000004', n, 'A' || n,
       'b5900000-0000-0000-0000-0000000000a1', 'p59/d' || n || '-v2.jpg'
  from generate_series(1, 6) as n;
insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url) values
  ('b5900000-0000-0000-0000-0000000000d9', 'b5900000-0000-0000-0000-000000000014', 1, 'B1',
   'b5900000-0000-0000-0000-0000000000a1', 'p59/d9-v2.jpg');

create function pg_temp.como(p_usuario text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_usuario, true);
  set local role authenticated;
end;
$$;
create function pg_temp.arbol(p_n int) returns uuid language sql as $$
  select ('b5900000-0000-0000-0000-0000000000d' || p_n)::uuid;
$$;
create function pg_temp.foto(p_n int) returns text language sql as $$
  select foto_url from trees where id = pg_temp.arbol(p_n);
$$;
create function pg_temp.anotadas(p_n int) returns int language sql as $$
  select count(*)::int from fotos_quitadas where tree_id = pg_temp.arbol(p_n);
$$;

-- ── Base vigente: quita ──────────────────────────────────────────────────────
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(1)], jsonb_build_object(pg_temp.arbol(1), 'p59/d1-v2.jpg')),
  '{"success": true, "quitadas": 1, "rechazados": [], "conservados": {"arboles": []}}'::jsonb,
  'base vigente: la quita y no conserva nada');
reset role;
select is(pg_temp.foto(1), null, 'base vigente: foto_url queda en null');
select is(pg_temp.anotadas(1), 1, 'base vigente: la foto queda anotada para el cron');

-- ── Base vieja: conserva y devuelve ──────────────────────────────────────────
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(2)], jsonb_build_object(pg_temp.arbol(2), 'p59/d2-v1.jpg')),
  jsonb_build_object('success', true, 'quitadas', 0, 'rechazados', '[]'::jsonb,
    'conservados', jsonb_build_object('arboles', jsonb_build_array(
      jsonb_build_object('id', pg_temp.arbol(2), 'foto_url', 'p59/d2-v2.jpg')))),
  'base vieja: no la quita y la devuelve conservada');
reset role;
select is(pg_temp.foto(2), 'p59/d2-v2.jpg', 'base vieja: la foto nueva sigue');
select is(pg_temp.anotadas(2), 0, 'base vieja: no se anota para el cron');

-- ── Base null: el móvil no vio foto y el servidor tiene una ──────────────────
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(3)], jsonb_build_object(pg_temp.arbol(3), null))
    -> 'conservados' -> 'arboles' -> 0 ->> 'foto_url',
  'p59/d3-v2.jpg',
  'base null: la foto del servidor vuelve conservada');
reset role;
select is(pg_temp.foto(3), 'p59/d3-v2.jpg', 'base null: la foto sigue');

-- ── Sin base: quita como antes (APK de prod) ─────────────────────────────────
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(4)]),
  '{"success": true, "quitadas": 1, "rechazados": [], "conservados": {"arboles": []}}'::jsonb,
  'sin p_bases: la quita');
reset role;
select is(pg_temp.foto(4), null, 'sin p_bases: foto_url queda en null');

-- Un lote mezclado: el árbol sin base en el mapa se quita, el de base vieja no.
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(5), pg_temp.arbol(2)], jsonb_build_object(pg_temp.arbol(2), 'p59/d2-v1.jpg'))
    -> 'quitadas',
  '1'::jsonb,
  'lote: quita solo el árbol que no trae base');
reset role;
select is(array[pg_temp.foto(5), pg_temp.foto(2)], array[null, 'p59/d2-v2.jpg'],
  'lote: el sin base queda sin foto, el de base vieja la conserva');

-- `p_bases` que no es un objeto cuenta como sin base.
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is((quitar_fotos_arboles(array[pg_temp.arbol(6)], '[]'::jsonb) ->> 'quitadas')::int, 1,
  'p_bases que no es un objeto: quita como sin base');
reset role;

-- ── Ya sin foto: nada que quitar ni conservar ────────────────────────────────
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(1)], jsonb_build_object(pg_temp.arbol(1), 'p59/d1-v1.jpg')),
  '{"success": true, "quitadas": 0, "rechazados": [], "conservados": {"arboles": []}}'::jsonb,
  'el servidor ya no tiene foto: no conserva aunque la base sea otra');
reset role;

-- ── Permisos de 072 ──────────────────────────────────────────────────────────
-- Un técnico que no creó el grupo: ni quita ni se entera de la foto del servidor.
select pg_temp.como('b5900000-0000-0000-0000-0000000000a2');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(2)], jsonb_build_object(pg_temp.arbol(2), 'p59/d2-v1.jpg')),
  '{"success": true, "quitadas": 0, "rechazados": [], "conservados": {"arboles": []}}'::jsonb,
  'técnico ajeno: no conserva ni rechaza el árbol de otro grupo');
select is(
  (quitar_fotos_arboles(array[pg_temp.arbol(2)], jsonb_build_object(pg_temp.arbol(2), 'p59/d2-v2.jpg')) ->> 'quitadas')::int,
  0,
  'técnico ajeno: con la base vigente tampoco la quita');
reset role;
select is(pg_temp.foto(2), 'p59/d2-v2.jpg', 'técnico ajeno: la foto sigue');

-- El admin sí, en un grupo ajeno, con la base vigente.
select pg_temp.como('b5900000-0000-0000-0000-0000000000a3');
select is(
  (quitar_fotos_arboles(array[pg_temp.arbol(2)], jsonb_build_object(pg_temp.arbol(2), 'p59/d2-v2.jpg')) ->> 'quitadas')::int,
  1,
  'admin: con la base vigente quita la foto de un grupo ajeno');
reset role;

-- Plantación finalizada: rechazado, no conservado.
select pg_temp.como('b5900000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(9)], jsonb_build_object(pg_temp.arbol(9), 'p59/d9-v1.jpg')),
  jsonb_build_object('success', true, 'quitadas', 0, 'rechazados', jsonb_build_array(pg_temp.arbol(9)),
    'conservados', jsonb_build_object('arboles', '[]'::jsonb)),
  'plantación finalizada: el id vuelve rechazado y no conservado');
reset role;
select is(pg_temp.foto(9), 'p59/d9-v2.jpg', 'plantación finalizada: la foto sigue');

-- ── Grants ───────────────────────────────────────────────────────────────────
select ok(
  not has_function_privilege('anon', 'quitar_fotos_arboles(uuid[], jsonb)', 'execute'),
  'anon no puede ejecutarla');
select ok(
  has_function_privilege('authenticated', 'quitar_fotos_arboles(uuid[], jsonb)', 'execute'),
  'authenticated la ejecuta');
select ok(
  not has_function_privilege('authenticated', 'quitar_fotos_foto_difiere(jsonb, uuid, text)', 'execute'),
  'authenticated no llama al helper directo');

select * from finish();
rollback;
