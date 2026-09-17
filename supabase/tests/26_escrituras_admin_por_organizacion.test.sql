-- Escrituras de admin acotadas a la organización (048, #543). Dos organizaciones:
-- A es la del que escribe, B la ajena. Cada caso cruzado tiene su control en A.
begin;
select plan(34);

insert into organizations (id, nombre) values
  ('b2600000-0000-0000-0000-00000000000a', 'Org A Test 26'),
  ('b2600000-0000-0000-0000-00000000000b', 'Org B Test 26');

insert into auth.users (id, email) values
  ('b2600000-0000-0000-0000-0000000000a1', 'admin-a-26@test.local'),
  ('b2600000-0000-0000-0000-0000000000a2', 'super-a-26@test.local'),
  ('b2600000-0000-0000-0000-0000000000a3', 'tecnico-a-26@test.local'),
  ('b2600000-0000-0000-0000-0000000000a4', 'tecnico2-a-26@test.local'),
  ('b2600000-0000-0000-0000-0000000000b1', 'admin-b-26@test.local'),
  ('b2600000-0000-0000-0000-0000000000b3', 'tecnico-b-26@test.local');

update profiles set organizacion_id = 'b2600000-0000-0000-0000-00000000000a'
  where id::text like 'b2600000-0000-0000-0000-0000000000a%';
update profiles set organizacion_id = 'b2600000-0000-0000-0000-00000000000b'
  where id::text like 'b2600000-0000-0000-0000-0000000000b%';
update profiles set rol = 'admin'
  where id in ('b2600000-0000-0000-0000-0000000000a1', 'b2600000-0000-0000-0000-0000000000b1');
update profiles set rol = 'superadmin' where id = 'b2600000-0000-0000-0000-0000000000a2';

-- Los triggers suman a los admin de cada organización a su plantación.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('b2600000-0000-0000-0000-0000000000aa', 'b2600000-0000-0000-0000-00000000000a',
   'Plantación A 26', '2026', 'b2600000-0000-0000-0000-0000000000a1'),
  ('b2600000-0000-0000-0000-0000000000bb', 'b2600000-0000-0000-0000-00000000000b',
   'Plantación B 26', '2026', 'b2600000-0000-0000-0000-0000000000b1');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b2600000-0000-0000-0000-0000000000aa', 'b2600000-0000-0000-0000-0000000000a3', 'tecnico'),
  ('b2600000-0000-0000-0000-0000000000bb', 'b2600000-0000-0000-0000-0000000000b3', 'tecnico');

insert into species (id, codigo, nombre) values
  ('b2600000-0000-0000-0000-000000000051', 'SP26a', 'Especie 26a'),
  ('b2600000-0000-0000-0000-000000000052', 'SP26b', 'Especie 26b');

insert into plantation_species (plantation_id, species_id, orden_visual) values
  ('b2600000-0000-0000-0000-0000000000aa', 'b2600000-0000-0000-0000-000000000051', 1),
  ('b2600000-0000-0000-0000-0000000000bb', 'b2600000-0000-0000-0000-000000000051', 1);

-- Sin lectura abierta, un UPDATE o DELETE sobre filas ajenas no las alcanza por
-- la policy SELECT y los casos pasarían aun sin 048.
create policy "test 26 lectura plantations" on plantations for select to authenticated using (true);
create policy "test 26 lectura plantation_species" on plantation_species for select to authenticated using (true);
create policy "test 26 lectura plantation_users" on plantation_users for select to authenticated using (true);
create policy "test 26 lectura profiles" on profiles for select to authenticated using (true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2600000-0000-0000-0000-0000000000a1', true);

-- ── plantation_users: INSERT ─────────────────────────────────────────────────
select throws_ok(
  $$ insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
     values ('b2600000-0000-0000-0000-0000000000bb', 'b2600000-0000-0000-0000-0000000000a1', 'tecnico') $$,
  '42501', null, 'admin A no se asigna en una plantación de B');
select throws_ok(
  $$ insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
     values ('b2600000-0000-0000-0000-0000000000bb', 'b2600000-0000-0000-0000-0000000000a4', 'tecnico') $$,
  '42501', null, 'admin A no asigna a un técnico propio en una plantación de B');
select throws_ok(
  $$ insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
     values ('b2600000-0000-0000-0000-0000000000aa', 'b2600000-0000-0000-0000-0000000000b3', 'tecnico') $$,
  '42501', null, 'admin A no asigna a un usuario de B en su plantación');
select throws_ok(
  $$ insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
     values ('b2600000-0000-0000-0000-0000000000aa', 'b2600000-0000-0000-0000-0000000000a4', 'admin') $$,
  '42501', null, 'admin A no crea membresías admin por PostgREST');
select lives_ok(
  $$ insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
     values ('b2600000-0000-0000-0000-0000000000aa', 'b2600000-0000-0000-0000-0000000000a4', 'tecnico') $$,
  'admin A asigna a un técnico de A en su plantación');

-- ── plantation_users: DELETE ─────────────────────────────────────────────────
delete from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000bb'
    and user_id = 'b2600000-0000-0000-0000-0000000000b3';
delete from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'
    and user_id = 'b2600000-0000-0000-0000-0000000000a2';
delete from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'
    and user_id = 'b2600000-0000-0000-0000-0000000000a3';

select is((select count(*)::int from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000bb'
    and user_id = 'b2600000-0000-0000-0000-0000000000b3'), 1,
  'admin A no quita técnicos de una plantación de B');
select is((select rol_en_plantacion from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'
    and user_id = 'b2600000-0000-0000-0000-0000000000a2'), 'admin',
  'admin A no borra la membresía admin automática');
select is((select count(*)::int from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'
    and user_id = 'b2600000-0000-0000-0000-0000000000a3'), 0,
  'admin A quita técnicos de su plantación');

-- ── plantation_species ───────────────────────────────────────────────────────
select throws_ok(
  $$ insert into plantation_species (plantation_id, species_id)
     values ('b2600000-0000-0000-0000-0000000000bb', 'b2600000-0000-0000-0000-000000000052') $$,
  '42501', null, 'admin A no agrega especies a una plantación de B');
update plantation_species set orden_visual = 9
  where plantation_id = 'b2600000-0000-0000-0000-0000000000bb';
select is((select orden_visual from plantation_species
  where plantation_id = 'b2600000-0000-0000-0000-0000000000bb'), 1,
  'admin A no reordena especies de una plantación de B');
delete from plantation_species where plantation_id = 'b2600000-0000-0000-0000-0000000000bb';
select is((select count(*)::int from plantation_species
  where plantation_id = 'b2600000-0000-0000-0000-0000000000bb'), 1,
  'admin A no quita especies de una plantación de B');

select lives_ok(
  $$ insert into plantation_species (plantation_id, species_id)
     values ('b2600000-0000-0000-0000-0000000000aa', 'b2600000-0000-0000-0000-000000000052') $$,
  'admin A agrega especies a su plantación');
update plantation_species set orden_visual = 9
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'
    and species_id = 'b2600000-0000-0000-0000-000000000051';
select is((select orden_visual from plantation_species
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'
    and species_id = 'b2600000-0000-0000-0000-000000000051'), 9,
  'admin A reordena especies de su plantación');
delete from plantation_species
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'
    and species_id = 'b2600000-0000-0000-0000-000000000052';
select is((select count(*)::int from plantation_species
  where plantation_id = 'b2600000-0000-0000-0000-0000000000aa'), 1,
  'admin A quita especies de su plantación');

-- ── plantations ──────────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into plantations (organizacion_id, lugar, periodo, creado_por)
     values ('b2600000-0000-0000-0000-00000000000b', 'Intrusa 26', '2026',
             'b2600000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'admin A no crea plantaciones a nombre de B');
select lives_ok(
  $$ insert into plantations (organizacion_id, lugar, periodo, creado_por)
     values ('b2600000-0000-0000-0000-00000000000a', 'Propia 26', '2026',
             'b2600000-0000-0000-0000-0000000000a1') $$,
  'admin A crea plantaciones de A');

update plantations set lugar = 'Editada por A' where id = 'b2600000-0000-0000-0000-0000000000bb';
select is((select lugar from plantations where id = 'b2600000-0000-0000-0000-0000000000bb'),
  'Plantación B 26', 'admin A no edita una plantación de B');
select throws_ok(
  $$ update plantations set organizacion_id = 'b2600000-0000-0000-0000-00000000000b'
     where id = 'b2600000-0000-0000-0000-0000000000aa' $$,
  '42501', null, 'admin A no mueve su plantación a B');
update plantations set lugar = 'Editada por A' where id = 'b2600000-0000-0000-0000-0000000000aa';
select is((select lugar from plantations where id = 'b2600000-0000-0000-0000-0000000000aa'),
  'Editada por A', 'admin A edita su plantación');

-- ── Superadmin ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2600000-0000-0000-0000-0000000000a2', true);

select throws_ok(
  $$ insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
     values ('b2600000-0000-0000-0000-0000000000bb', 'b2600000-0000-0000-0000-0000000000a3', 'tecnico') $$,
  '42501', null, 'superadmin A no asigna en una plantación de B');
update profiles set nombre = 'Editado por A' where id = 'b2600000-0000-0000-0000-0000000000b3';
select isnt((select nombre from profiles where id = 'b2600000-0000-0000-0000-0000000000b3'),
  'Editado por A', 'superadmin A no edita perfiles de B');
select throws_ok(
  $$ update profiles set organizacion_id = 'b2600000-0000-0000-0000-00000000000b'
     where id = 'b2600000-0000-0000-0000-0000000000a3' $$,
  '42501', null, 'superadmin A no mueve un perfil a B');
update profiles set nombre = 'Editado por A' where id = 'b2600000-0000-0000-0000-0000000000a3';
select is((select nombre from profiles where id = 'b2600000-0000-0000-0000-0000000000a3'),
  'Editado por A', 'superadmin A edita perfiles de A');

-- ── La organización B sigue gestionando lo suyo ─────────────────────────────
select set_config('request.jwt.claim.sub', 'b2600000-0000-0000-0000-0000000000b1', true);

delete from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000bb'
    and user_id = 'b2600000-0000-0000-0000-0000000000b3';
select is((select count(*)::int from plantation_users
  where plantation_id = 'b2600000-0000-0000-0000-0000000000bb'
    and user_id = 'b2600000-0000-0000-0000-0000000000b3'), 0,
  'admin B quita técnicos de su plantación');
update plantations set lugar = 'Editada por B' where id = 'b2600000-0000-0000-0000-0000000000bb';
select is((select lugar from plantations where id = 'b2600000-0000-0000-0000-0000000000bb'),
  'Editada por B', 'admin B edita su plantación');

-- ── Helpers ──────────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub', 'b2600000-0000-0000-0000-0000000000a1', true);

select is(plantacion_de_mi_organizacion('b2600000-0000-0000-0000-0000000000aa'), true, 'plantación de A es de A');
select is(plantacion_de_mi_organizacion('b2600000-0000-0000-0000-0000000000bb'), false, 'plantación de B no es de A');
select is(plantacion_de_mi_organizacion('b2600000-0000-0000-0000-0000000000ff'), false, 'una inexistente no es de nadie');
select is(perfil_de_mi_organizacion('b2600000-0000-0000-0000-0000000000a3'), true, 'perfil de A es de A');
select is(perfil_de_mi_organizacion('b2600000-0000-0000-0000-0000000000b3'), false, 'perfil de B no es de A');
select is(puede_archivar_plantacion('b2600000-0000-0000-0000-0000000000aa'), true, 'admin A archiva su plantación');
select is(puede_archivar_plantacion('b2600000-0000-0000-0000-0000000000bb'), false, 'admin A no archiva una de B');

reset role;
select is(has_function_privilege('anon', 'public.plantacion_de_mi_organizacion(uuid)', 'execute'), false,
  'anon no ejecuta plantacion_de_mi_organizacion');
select is(has_function_privilege('anon', 'public.perfil_de_mi_organizacion(uuid)', 'execute'), false,
  'anon no ejecuta perfil_de_mi_organizacion');

select * from finish();
rollback;
