-- sincronizar_borrados aplica la regla de escritura de #768 (073, #796): el
-- árbol y el grupo de un grupo ajeno los borran admin y superadmin, no un
-- técnico. Lo que se saltea no vuelve en `rechazados`: quedaría pendiente en el
-- teléfono para siempre.
begin;
select plan(16);

insert into organizations (id, nombre) values
  ('b5600000-0000-0000-0000-000000000001', 'Org Test 56');

-- tp: técnico que prueba sobre lo ajeno. to: técnico creador de los grupos.
insert into auth.users (id, email) values
  ('b5600000-0000-0000-0000-0000000000a1', 'tp-56@test.local'),
  ('b5600000-0000-0000-0000-0000000000a2', 'to-56@test.local'),
  ('b5600000-0000-0000-0000-0000000000a3', 'admin-56@test.local'),
  ('b5600000-0000-0000-0000-0000000000a4', 'super-56@test.local');
update profiles set organizacion_id = 'b5600000-0000-0000-0000-000000000001' where id::text like 'b5600000-%';
update profiles set rol = 'admin' where id = 'b5600000-0000-0000-0000-0000000000a3';
update profiles set rol = 'superadmin' where id = 'b5600000-0000-0000-0000-0000000000a4';

-- Admin y superadmin quedan miembros por trigger; los técnicos, asignados.
select tests.crear_plantacion('b5600000-0000-0000-0000-000000000010', 'b5600000-0000-0000-0000-000000000001',
  'b5600000-0000-0000-0000-0000000000a3');
insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b5600000-0000-0000-0000-000000000010', 'b5600000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b5600000-0000-0000-0000-000000000010', 'b5600000-0000-0000-0000-0000000000a2', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5600000-0000-0000-0000-000000000011', 'b5600000-0000-0000-0000-000000000010', 'Norte', 'P1');

-- Tres grupos de `to` con un árbol cada uno: 2x es el grupo, 3x su árbol.
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador)
select ('b5600000-0000-0000-0000-00000000002' || n)::uuid, 'b5600000-0000-0000-0000-000000000010',
       'b5600000-0000-0000-0000-000000000011', 'G' || n, 'G' || n, 'linea', 'activa',
       'b5600000-0000-0000-0000-0000000000a2'
  from generate_series(1, 3) as n;
insert into trees (id, group_id, posicion, sub_id, usuario_registro)
select ('b5600000-0000-0000-0000-00000000003' || n)::uuid, ('b5600000-0000-0000-0000-00000000002' || n)::uuid,
       1, 'P1G' || n || 'NN1', 'b5600000-0000-0000-0000-0000000000a2'
  from generate_series(1, 3) as n;

-- Borra el árbol 3n y el grupo 2n como `p_usuario`.
create function pg_temp.borra(p_usuario text, n int) returns jsonb language plpgsql as $$
declare
  v_resultado jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_usuario, true);
  set local role authenticated;
  v_resultado := sincronizar_borrados(jsonb_build_array(
    jsonb_build_object('id', 'b5600000-0000-0000-0000-00000000003' || n, 'tipo', 'arbol'),
    jsonb_build_object('id', 'b5600000-0000-0000-0000-00000000002' || n, 'tipo', 'grupo')));
  reset role;
  return v_resultado;
end;
$$;

create function pg_temp.quedan(n int) returns int language sql as $$
  select (select count(*) from trees where id = ('b5600000-0000-0000-0000-00000000003' || n)::uuid)::int
       + (select count(*) from groups where id = ('b5600000-0000-0000-0000-00000000002' || n)::uuid)::int;
$$;

create temp table r56 (quien text primary key, resultado jsonb);

-- ── Técnico sobre lo ajeno ───────────────────────────────────────────────────

insert into r56 values ('tp', pg_temp.borra('b5600000-0000-0000-0000-0000000000a1', 1));
select is((select (resultado ->> 'success')::boolean from r56 where quien = 'tp'), true,
  'técnico: el borrado ajeno no es un error');
select is((select (resultado ->> 'arboles')::int + (resultado ->> 'grupos')::int from r56 where quien = 'tp'), 0,
  'técnico: no borra el árbol ni el grupo de otro');
select is((select resultado -> 'rechazados' from r56 where quien = 'tp'), '[]'::jsonb,
  'técnico: lo ajeno no vuelve en rechazados (quedaría pendiente para siempre)');
select is((select resultado -> 'rechazos' from r56 where quien = 'tp'), '[]'::jsonb,
  'técnico: lo ajeno no vuelve en rechazos');
select is(pg_temp.quedan(1), 2, 'técnico: el árbol y el grupo ajenos siguen');

-- ── Admin y superadmin sobre lo ajeno ────────────────────────────────────────

insert into r56 values ('admin', pg_temp.borra('b5600000-0000-0000-0000-0000000000a3', 2));
select is((select (resultado ->> 'arboles')::int from r56 where quien = 'admin'), 1,
  'admin: borra el árbol de un grupo ajeno');
select is((select (resultado ->> 'grupos')::int from r56 where quien = 'admin'), 1,
  'admin: borra un grupo ajeno');
select is((select resultado -> 'rechazados' from r56 where quien = 'admin'), '[]'::jsonb,
  'admin: sin rechazados');
select is(pg_temp.quedan(2), 0, 'admin: el árbol y el grupo ajenos ya no están');

insert into r56 values ('super', pg_temp.borra('b5600000-0000-0000-0000-0000000000a4', 3));
select is((select (resultado ->> 'arboles')::int from r56 where quien = 'super'), 1,
  'superadmin: borra el árbol de un grupo ajeno');
select is((select (resultado ->> 'grupos')::int from r56 where quien = 'super'), 1,
  'superadmin: borra un grupo ajeno');
select is(pg_temp.quedan(3), 0, 'superadmin: el árbol y el grupo ajenos ya no están');

-- ── El creador sobre lo suyo ─────────────────────────────────────────────────

insert into r56 values ('to', pg_temp.borra('b5600000-0000-0000-0000-0000000000a2', 1));
select is((select (resultado ->> 'arboles')::int from r56 where quien = 'to'), 1,
  'creador: borra el árbol de su grupo');
select is((select (resultado ->> 'grupos')::int from r56 where quien = 'to'), 1,
  'creador: borra su grupo');
select is((select resultado -> 'rechazados' from r56 where quien = 'to'), '[]'::jsonb,
  'creador: sin rechazados');
select is(pg_temp.quedan(1), 0, 'creador: el árbol y el grupo ya no están');

select * from finish();
rollback;
