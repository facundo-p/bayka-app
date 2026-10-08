-- Un grupo nuevo lo sube solo quien figura como su creador, sea cual sea su rol
-- (074, #798). Un grupo que ya existe sigue la regla de 072: el admin lo sube
-- con el creador que tiene, como lo manda el móvil.
begin;
select plan(9);

insert into organizations (id, nombre) values
  ('b5700000-0000-0000-0000-000000000001', 'Org Test 57');

-- tp: técnico que sube. to: técnico al que se le atribuye el grupo.
insert into auth.users (id, email) values
  ('b5700000-0000-0000-0000-0000000000a1', 'tp-57@test.local'),
  ('b5700000-0000-0000-0000-0000000000a2', 'to-57@test.local'),
  ('b5700000-0000-0000-0000-0000000000a3', 'admin-57@test.local'),
  ('b5700000-0000-0000-0000-0000000000a4', 'super-57@test.local');
update profiles set organizacion_id = 'b5700000-0000-0000-0000-000000000001' where id::text like 'b5700000-%';
update profiles set rol = 'admin' where id = 'b5700000-0000-0000-0000-0000000000a3';
update profiles set rol = 'superadmin' where id = 'b5700000-0000-0000-0000-0000000000a4';

-- Admin y superadmin quedan miembros por trigger; los técnicos, asignados.
select tests.crear_plantacion('b5700000-0000-0000-0000-000000000010', 'b5700000-0000-0000-0000-000000000001',
  'b5700000-0000-0000-0000-0000000000a3');
insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b5700000-0000-0000-0000-000000000010', 'b5700000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b5700000-0000-0000-0000-000000000010', 'b5700000-0000-0000-0000-0000000000a2', 'tecnico');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b5700000-0000-0000-0000-000000000011', 'b5700000-0000-0000-0000-000000000010', 'Norte', 'P1');

-- Sube como `p_usuario` el grupo 2n, atribuido a `p_creador`. Devuelve 'ok' o el error.
create function pg_temp.sube(p_usuario text, p_creador text, n int) returns text language plpgsql as $$
declare
  v_resultado jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_usuario, true);
  set local role authenticated;
  v_resultado := sync_subgroup(
    jsonb_build_object(
      'id', 'b5700000-0000-0000-0000-00000000002' || n, 'plantation_id', 'b5700000-0000-0000-0000-000000000010',
      'parcela_id', 'b5700000-0000-0000-0000-000000000011',
      'nombre', 'G' || n, 'codigo', 'G' || n, 'tipo', 'linea', 'estado', 'activa',
      'usuario_creador', p_creador, 'created_at', now(), 'parcela_codigo', 'P1'),
    '[]'::jsonb);
  reset role;
  return case when (v_resultado ->> 'success')::boolean then 'ok' else v_resultado ->> 'error' end;
end;
$$;

create function pg_temp.existe(n int) returns boolean language sql as $$
  select exists (select 1 from groups where id = ('b5700000-0000-0000-0000-00000000002' || n)::uuid);
$$;

-- ── Grupo nuevo a nombre de otro ─────────────────────────────────────────────

select is(pg_temp.sube('b5700000-0000-0000-0000-0000000000a1', 'b5700000-0000-0000-0000-0000000000a2', 1),
  'PERMISSION', 'técnico: no sube un grupo nuevo a nombre de otro');
select is(pg_temp.sube('b5700000-0000-0000-0000-0000000000a3', 'b5700000-0000-0000-0000-0000000000a2', 2),
  'PERMISSION', 'admin: no sube un grupo nuevo a nombre de otro');
select is(pg_temp.sube('b5700000-0000-0000-0000-0000000000a4', 'b5700000-0000-0000-0000-0000000000a2', 3),
  'PERMISSION', 'superadmin: no sube un grupo nuevo a nombre de otro');
select ok(not (pg_temp.existe(1) or pg_temp.existe(2) or pg_temp.existe(3)),
  'los grupos rechazados no se crearon');

-- ── Grupo nuevo a nombre propio ──────────────────────────────────────────────

select is(pg_temp.sube('b5700000-0000-0000-0000-0000000000a1', 'b5700000-0000-0000-0000-0000000000a1', 4),
  'ok', 'técnico: sube un grupo nuevo a su nombre');
select is(pg_temp.sube('b5700000-0000-0000-0000-0000000000a3', 'b5700000-0000-0000-0000-0000000000a3', 5),
  'ok', 'admin: sube un grupo nuevo a su nombre');
select is(
  (select count(*)::int from groups
    where (id, usuario_creador) in (
      ('b5700000-0000-0000-0000-000000000024'::uuid, 'b5700000-0000-0000-0000-0000000000a1'::uuid),
      ('b5700000-0000-0000-0000-000000000025'::uuid, 'b5700000-0000-0000-0000-0000000000a3'::uuid))),
  2, 'los grupos aceptados quedan a nombre de quien los subió');

-- ── Grupo que ya existe ──────────────────────────────────────────────────────

-- Ya creado por `to`: el admin lo sube con ese creador, y el técnico ajeno sigue sin poder.
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador) values
  ('b5700000-0000-0000-0000-000000000026', 'b5700000-0000-0000-0000-000000000010',
   'b5700000-0000-0000-0000-000000000011', 'G6', 'G6', 'linea', 'activa', 'b5700000-0000-0000-0000-0000000000a2');
select is(pg_temp.sube('b5700000-0000-0000-0000-0000000000a3', 'b5700000-0000-0000-0000-0000000000a2', 6),
  'ok', 'admin: sube un grupo existente de otro con su creador');
select is(pg_temp.sube('b5700000-0000-0000-0000-0000000000a1', 'b5700000-0000-0000-0000-0000000000a2', 6),
  'PERMISSION', 'técnico: sigue sin subir un grupo existente de otro');

select * from finish();
rollback;
