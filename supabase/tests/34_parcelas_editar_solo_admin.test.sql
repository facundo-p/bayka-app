-- El técnico crea parcelas pero no las edita ni las borra; admin y superadmin
-- sí (056, #640). Se prueba también el upsert del móvil, en sus dos variantes.
begin;
select plan(12);

insert into organizations (id, nombre) values
  ('b3400000-0000-0000-0000-000000000001', 'Org Test 34');

insert into auth.users (id, email) values
  ('b3400000-0000-0000-0000-0000000000a1', 'tecnico-34@test.local'),
  ('b3400000-0000-0000-0000-0000000000a2', 'admin-34@test.local'),
  ('b3400000-0000-0000-0000-0000000000a3', 'super-34@test.local');

update profiles set organizacion_id = 'b3400000-0000-0000-0000-000000000001'
  where id = 'b3400000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', organizacion_id = 'b3400000-0000-0000-0000-000000000001'
  where id = 'b3400000-0000-0000-0000-0000000000a2';
update profiles set rol = 'superadmin', organizacion_id = 'b3400000-0000-0000-0000-000000000001'
  where id = 'b3400000-0000-0000-0000-0000000000a3';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('b3400000-0000-0000-0000-000000000002', 'b3400000-0000-0000-0000-000000000001',
   'Activa 34', '2026', 'b3400000-0000-0000-0000-0000000000a2', 'activa');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b3400000-0000-0000-0000-000000000002', 'b3400000-0000-0000-0000-0000000000a1', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3400000-0000-0000-0000-0000000000b1', 'b3400000-0000-0000-0000-000000000002', 'Norte', 'P1'),
  ('b3400000-0000-0000-0000-0000000000b2', 'b3400000-0000-0000-0000-000000000002', 'Sur', 'P2');

create temp view parcelas_34 as
  select id, nombre, deleted_at from parcelas
  where plantation_id = 'b3400000-0000-0000-0000-000000000002';
grant select on parcelas_34 to authenticated;

set local role authenticated;

-- ── Técnico ──────────────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3400000-0000-0000-0000-0000000000a1', true);

select lives_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('b3400000-0000-0000-0000-0000000000b3', 'b3400000-0000-0000-0000-000000000002', 'Este', 'P3')$$,
  'el técnico crea una parcela');

select lives_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('b3400000-0000-0000-0000-0000000000b4', 'b3400000-0000-0000-0000-000000000002', 'Oeste', 'P4')
    on conflict (id) do update set nombre = excluded.nombre$$,
  'el técnico crea por upsert si la parcela no existe');

-- Los UPDATE que la policy no deja ver no explotan: quedan en cero filas.
update parcelas set nombre = 'Norte editada' where id = 'b3400000-0000-0000-0000-0000000000b1';
update parcelas set deleted_at = now() where id = 'b3400000-0000-0000-0000-0000000000b2';

select is((select nombre from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b1'),
  'Norte', 'el técnico no edita una parcela');
select is((select deleted_at from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b2'),
  null, 'el técnico no tombstonea una parcela');

select throws_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('b3400000-0000-0000-0000-0000000000b1', 'b3400000-0000-0000-0000-000000000002', 'Norte upsert', 'P1')
    on conflict (id) do update set nombre = excluded.nombre$$,
  '42501', null, 'el upsert del técnico sobre una parcela existente se rechaza');

select lives_ok(
  $$insert into parcelas (id, plantation_id, nombre, codigo)
    values ('b3400000-0000-0000-0000-0000000000b1', 'b3400000-0000-0000-0000-000000000002', 'Norte ignorada', 'P1')
    on conflict (id) do nothing$$,
  'con ON CONFLICT DO NOTHING el upsert del técnico no falla');
select is((select nombre from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b1'),
  'Norte', 'y no cambia la parcela existente');

select is((select nombre from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b3'),
  'Este', 'no puede corregir ni la parcela que acaba de crear');
update parcelas set nombre = 'Este editada' where id = 'b3400000-0000-0000-0000-0000000000b3';
select is((select nombre from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b3'),
  'Este', 'la edición de su propia parcela queda sin efecto');

-- ── Admin y superadmin ──────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', 'b3400000-0000-0000-0000-0000000000a2', true);

insert into parcelas (id, plantation_id, nombre, codigo)
  values ('b3400000-0000-0000-0000-0000000000b1', 'b3400000-0000-0000-0000-000000000002', 'Norte admin', 'P1')
  on conflict (id) do update set nombre = excluded.nombre;
select is((select nombre from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b1'),
  'Norte admin', 'el admin edita por upsert');

update parcelas set deleted_at = now() where id = 'b3400000-0000-0000-0000-0000000000b2';
select isnt((select deleted_at from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b2'),
  null, 'el admin tombstonea');

select set_config('request.jwt.claim.sub', 'b3400000-0000-0000-0000-0000000000a3', true);

update parcelas set nombre = 'Este super' where id = 'b3400000-0000-0000-0000-0000000000b3';
select is((select nombre from parcelas_34 where id = 'b3400000-0000-0000-0000-0000000000b3'),
  'Este super', 'el superadmin edita');

select * from finish();
rollback;
