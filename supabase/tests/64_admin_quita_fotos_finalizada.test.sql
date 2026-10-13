-- Un admin quita fotos en una plantación finalizada (082, #903). El técnico
-- sigue sin poder, una archivada no admite a nadie, y la excepción no abre el
-- resto de la finalizada al admin.
begin;
select plan(11);

insert into organizations (id, nombre) values ('b6400000-0000-0000-0000-000000000001', 'Org Test 64');

-- tc: técnico creador de los grupos. ad: admin. sa: superadmin.
insert into auth.users (id, email) values
  ('b6400000-0000-0000-0000-0000000000a1', 'tc-64@test.local'),
  ('b6400000-0000-0000-0000-0000000000a2', 'admin-64@test.local'),
  ('b6400000-0000-0000-0000-0000000000a3', 'superadmin-64@test.local');
update profiles set organizacion_id = 'b6400000-0000-0000-0000-000000000001' where id::text like 'b6400000-%';
update profiles set rol = 'admin' where id = 'b6400000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin' where id = 'b6400000-0000-0000-0000-0000000000a3';

-- p1 finalizada, p2 archivada.
select tests.crear_plantacion('b6400000-0000-0000-0000-0000000000b1', 'b6400000-0000-0000-0000-000000000001',
  'b6400000-0000-0000-0000-0000000000a2', 'Finalizada 64', p_estado => 'finalizada');
select tests.crear_plantacion('b6400000-0000-0000-0000-0000000000b2', 'b6400000-0000-0000-0000-000000000001',
  'b6400000-0000-0000-0000-0000000000a2', 'Archivada 64', p_archivada_en => now());
insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b6400000-0000-0000-0000-0000000000b1', 'b6400000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b6400000-0000-0000-0000-0000000000b2', 'b6400000-0000-0000-0000-0000000000a1', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b6400000-0000-0000-0000-0000000000c1', 'b6400000-0000-0000-0000-0000000000b1', 'P64', 'P64'),
  ('b6400000-0000-0000-0000-0000000000c2', 'b6400000-0000-0000-0000-0000000000b2', 'P64b', 'P64b');
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b6400000-0000-0000-0000-0000000000e1', 'b6400000-0000-0000-0000-0000000000b1',
   'b6400000-0000-0000-0000-0000000000c1', 'G64', 'G64', 'linea', 'b6400000-0000-0000-0000-0000000000a1'),
  ('b6400000-0000-0000-0000-0000000000e2', 'b6400000-0000-0000-0000-0000000000b2',
   'b6400000-0000-0000-0000-0000000000c2', 'G64b', 'G64b', 'linea', 'b6400000-0000-0000-0000-0000000000a1');

-- d1..d3 en la finalizada, d4 en la archivada.
insert into trees (id, group_id, posicion, sub_id, usuario_registro, foto_url)
select ('b6400000-0000-0000-0000-0000000000d' || n)::uuid,
       case when n <= 3 then 'b6400000-0000-0000-0000-0000000000e1'::uuid
            else 'b6400000-0000-0000-0000-0000000000e2'::uuid end,
       n, 'A' || n, 'b6400000-0000-0000-0000-0000000000a1', 'p64/d' || n || '.jpg'
  from generate_series(1, 4) as n;

create function pg_temp.como(p_usuario text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_usuario, true);
  set local role authenticated;
end;
$$;
create function pg_temp.arbol(p_n int) returns uuid language sql as $$
  select ('b6400000-0000-0000-0000-0000000000d' || p_n)::uuid;
$$;
create function pg_temp.foto(p_n int) returns text language sql as $$
  select foto_url from trees where id = pg_temp.arbol(p_n);
$$;

-- ── Finalizada: el técnico no ────────────────────────────────────────────────
select pg_temp.como('b6400000-0000-0000-0000-0000000000a1');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(1)]) -> 'rechazados',
  jsonb_build_array(pg_temp.arbol(1)),
  'finalizada: al técnico le vuelve rechazado');
reset role;
select is(pg_temp.foto(1), 'p64/d1.jpg', 'finalizada: la foto sigue después del técnico');

-- ── Finalizada: el admin sí, con la base vigente ─────────────────────────────
select pg_temp.como('b6400000-0000-0000-0000-0000000000a2');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(1)], jsonb_build_object(pg_temp.arbol(1), 'p64/d1.jpg')),
  jsonb_build_object('success', true, 'quitadas', 1, 'rechazados', '[]'::jsonb,
    'conservados', jsonb_build_object('arboles', '[]'::jsonb)),
  'finalizada: el admin quita la foto');
reset role;
select is(pg_temp.foto(1), null, 'finalizada: foto_url queda en null');
select is(
  (select count(*)::int from fotos_quitadas where tree_id = pg_temp.arbol(1)),
  1,
  'finalizada: la foto queda anotada para limpiar');

-- La base que no coincide se sigue respetando.
select pg_temp.como('b6400000-0000-0000-0000-0000000000a2');
select is(
  (quitar_fotos_arboles(array[pg_temp.arbol(2)], jsonb_build_object(pg_temp.arbol(2), 'p64/vieja.jpg'))
    -> 'conservados' -> 'arboles' -> 0 ->> 'foto_url'),
  'p64/d2.jpg',
  'finalizada: con una base vieja el admin no la quita y vuelve conservada');
reset role;

-- ── Finalizada: el superadmin sigue pudiendo ─────────────────────────────────
select pg_temp.como('b6400000-0000-0000-0000-0000000000a3');
select is(
  (quitar_fotos_arboles(array[pg_temp.arbol(3)]) ->> 'quitadas')::int,
  1,
  'finalizada: el superadmin quita la foto');
reset role;

-- ── Archivada: nadie ─────────────────────────────────────────────────────────
select pg_temp.como('b6400000-0000-0000-0000-0000000000a3');
select is(
  quitar_fotos_arboles(array[pg_temp.arbol(4)]) -> 'rechazados',
  jsonb_build_array(pg_temp.arbol(4)),
  'archivada: al superadmin le vuelve rechazado');
reset role;
select is(pg_temp.foto(4), 'p64/d4.jpg', 'archivada: la foto sigue');

-- ── La excepción es solo para fotos ──────────────────────────────────────────
select pg_temp.como('b6400000-0000-0000-0000-0000000000a2');
select ok(
  not puede_editar_finalizada(),
  'el admin sigue sin poder editar el resto de una finalizada');
reset role;

select ok(
  not has_function_privilege('authenticated', 'puede_quitar_fotos_de_plantacion(uuid)', 'execute'),
  'authenticated no llama al helper directo');

select * from finish();
rollback;
