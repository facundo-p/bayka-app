-- generate_tree_ids (029): gate por rol global (admin/superadmin), no por
-- membresía de plantación.
begin;
select plan(5);

insert into organizations (id, nombre) values
  ('d0000000-0000-0000-0000-000000000001', 'Org Test 04');

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-0000000000a1', 'admin-04@test.local'),
  ('d0000000-0000-0000-0000-0000000000a2', 'tecnico-04@test.local');
update profiles set rol = 'admin' where id = 'd0000000-0000-0000-0000-0000000000a1';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
   'Lugar Test 04', '2026', 'd0000000-0000-0000-0000-0000000000a1');
-- trg_add_admin_memberships ya sumó al admin como miembro.

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002',
   'Parcela 04', 'P04');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002',
   'd0000000-0000-0000-0000-000000000003', 'G04', 'G04', 'linea',
   'd0000000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('d0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004', 1, 'A1',
   'd0000000-0000-0000-0000-0000000000a1'),
  ('d0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', 2, 'A2',
   'd0000000-0000-0000-0000-0000000000a1');

set local role authenticated;

-- Tecnico: NOT_AUTHORIZED, no toca las filas.
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000a2', true);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-000000000002'::uuid) ->> 'error' ),
  'NOT_AUTHORIZED',
  'un tecnico no puede generar IDs'
);

select is(
  ( select count(*)::int from trees
    where group_id = 'd0000000-0000-0000-0000-000000000004' and global_id is not null ),
  0,
  'ningún árbol quedó con global_id tras el intento del tecnico'
);

-- Admin: éxito, asigna global_id a todos los árboles de la plantación.
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000a1', true);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-000000000002'::uuid) ->> 'success' ),
  'true',
  'un admin genera los IDs correctamente'
);

select is(
  ( select count(*)::int from trees
    where group_id = 'd0000000-0000-0000-0000-000000000004' and global_id is not null ),
  2,
  'los dos árboles quedaron con global_id asignado'
);

select is(
  ( select count(distinct global_id)::int from trees
    where group_id = 'd0000000-0000-0000-0000-000000000004' ),
  2,
  'los global_id asignados son distintos entre sí'
);

select * from finish();
rollback;
