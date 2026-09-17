-- generate_tree_ids: admin o superadmin activo de la organización de la
-- plantación (#495), no por membresía. Rechaza archivadas; finalizadas sí.
begin;
select plan(14);

insert into organizations (id, nombre) values
  ('d0000000-0000-0000-0000-000000000001', 'Org Test 04'),
  ('d0000000-0000-0000-0000-000000000009', 'Otra Org 04');

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-0000000000a1', 'admin-04@test.local'),
  ('d0000000-0000-0000-0000-0000000000a2', 'tecnico-04@test.local'),
  ('d0000000-0000-0000-0000-0000000000a3', 'superadmin-otra-org-04@test.local'),
  ('d0000000-0000-0000-0000-0000000000a4', 'admin-inactivo-04@test.local'),
  ('d0000000-0000-0000-0000-0000000000a5', 'superadmin-04@test.local');
-- organizacion_id también, no solo rol: desde 033 la membresía admin
-- auto-otorgada por trigger exige que coincida con la de la plantación.
update profiles set rol = 'admin', organizacion_id = 'd0000000-0000-0000-0000-000000000001'
  where id = 'd0000000-0000-0000-0000-0000000000a1';
update profiles set rol = 'superadmin', organizacion_id = 'd0000000-0000-0000-0000-000000000009'
  where id = 'd0000000-0000-0000-0000-0000000000a3';
update profiles set rol = 'admin', activo = false,
  organizacion_id = 'd0000000-0000-0000-0000-000000000001'
  where id = 'd0000000-0000-0000-0000-0000000000a4';
update profiles set rol = 'superadmin', organizacion_id = 'd0000000-0000-0000-0000-000000000001'
  where id = 'd0000000-0000-0000-0000-0000000000a5';

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

-- P10: finalizada. P20: archivada. P30: finalizada y archivada. Un árbol cada una.
insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado, archivada_en) values
  ('d0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000001',
   'Finalizada 04', '2026', 'd0000000-0000-0000-0000-0000000000a1', 'finalizada', null),
  ('d0000000-0000-0000-0000-000000000020', 'd0000000-0000-0000-0000-000000000001',
   'Archivada 04', '2026', 'd0000000-0000-0000-0000-0000000000a1', 'activa', now()),
  ('d0000000-0000-0000-0000-000000000030', 'd0000000-0000-0000-0000-000000000001',
   'Finalizada archivada 04', '2026', 'd0000000-0000-0000-0000-0000000000a1', 'finalizada', now());

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('d0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000010', 'P04f', 'P04f'),
  ('d0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000020', 'P04a', 'P04a'),
  ('d0000000-0000-0000-0000-000000000031', 'd0000000-0000-0000-0000-000000000030', 'P04fa', 'P04fa');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('d0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000010',
   'd0000000-0000-0000-0000-000000000011', 'G04f', 'G04f', 'linea', 'd0000000-0000-0000-0000-0000000000a1'),
  ('d0000000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000020',
   'd0000000-0000-0000-0000-000000000021', 'G04a', 'G04a', 'linea', 'd0000000-0000-0000-0000-0000000000a1'),
  ('d0000000-0000-0000-0000-000000000032', 'd0000000-0000-0000-0000-000000000030',
   'd0000000-0000-0000-0000-000000000031', 'G04fa', 'G04fa', 'linea', 'd0000000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('d0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000012', 1, 'A1',
   'd0000000-0000-0000-0000-0000000000a1'),
  ('d0000000-0000-0000-0000-000000000023', 'd0000000-0000-0000-0000-000000000022', 1, 'A1',
   'd0000000-0000-0000-0000-0000000000a1'),
  ('d0000000-0000-0000-0000-000000000033', 'd0000000-0000-0000-0000-000000000032', 1, 'A1',
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

-- Otra organización: mismo error que sin rol, no revela que la plantación existe.
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000a3', true);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-000000000002'::uuid) ->> 'error' ),
  'NOT_AUTHORIZED',
  'un superadmin de otra organización no puede generar IDs'
);

select is(
  ( select count(*)::int from trees
    where group_id = 'd0000000-0000-0000-0000-000000000004' and global_id is not null ),
  0,
  'ningún árbol quedó con global_id tras el intento de otra organización'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000a4', true);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-000000000002'::uuid) ->> 'error' ),
  'NOT_AUTHORIZED',
  'un admin inactivo no puede generar IDs'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000a1', true);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-0000000000ff'::uuid) ->> 'error' ),
  'NOT_AUTHORIZED',
  'una plantación inexistente devuelve lo mismo que una ajena'
);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-000000000020'::uuid) ->> 'error' ),
  'PLANTACION_ARCHIVADA',
  'un admin no genera IDs en una plantación archivada'
);

select is(
  ( select count(*)::int from trees
    where group_id = 'd0000000-0000-0000-0000-000000000022' and global_id is not null ),
  0,
  'la archivada quedó sin global_id'
);

select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000a5', true);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-000000000030'::uuid) ->> 'error' ),
  'PLANTACION_ARCHIVADA',
  'finalizada y archivada: gana archivada, también para superadmin'
);

-- Finalizada: es el flujo normal, los IDs se generan después de finalizar.
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000a1', true);

select is(
  ( select generate_tree_ids('d0000000-0000-0000-0000-000000000010'::uuid) ->> 'success' ),
  'true',
  'un admin genera IDs en una plantación finalizada'
);

select is(
  ( select count(*)::int from trees
    where group_id = 'd0000000-0000-0000-0000-000000000012' and global_id is not null ),
  1,
  'el árbol de la finalizada quedó con global_id'
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
