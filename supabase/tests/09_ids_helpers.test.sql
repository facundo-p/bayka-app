-- plantation_ids_status / next_global_id_seed (032, #309) + regresión de
-- generate_tree_ids tras refactorizarla para reusar esos helpers.
begin;
select plan(15);

insert into organizations (id, nombre) values
  ('e0000000-0000-0000-0000-000000000001', 'Org Test 09');

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-0000000000a1', 'admin-09@test.local'),
  ('e0000000-0000-0000-0000-0000000000a2', 'tecnico-09@test.local'),
  ('e0000000-0000-0000-0000-0000000000a3', 'outsider-09@test.local');
-- organizacion_id también, no solo rol: desde 033 la membresía admin
-- auto-otorgada por trigger exige que coincida con la de la plantación.
update profiles set rol = 'admin', organizacion_id = 'e0000000-0000-0000-0000-000000000001'
  where id = 'e0000000-0000-0000-0000-0000000000a1';

-- Sin ningún tree en toda la base: seed arranca en 1.
select is(
  ( select next_global_id_seed() ),
  1,
  'next_global_id_seed devuelve 1 sin trees en la base'
);

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001',
   'Lugar Test 09', '2026', 'e0000000-0000-0000-0000-0000000000a1');
-- trg_add_admin_memberships ya sumó al admin como miembro; tecnico/outsider no.

-- Plantación sin grupos ni trees: status en cero.
select is(
  ( select total from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  0, 'plantation_ids_status.total en 0 sin trees'
);
select is(
  ( select con_id from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  0, 'plantation_ids_status.con_id en 0 sin trees'
);
select is(
  ( select generados from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  false, 'plantation_ids_status.generados false sin trees'
);

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002',
   'Parcela 09', 'P09');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002',
   'e0000000-0000-0000-0000-000000000003', 'G09', 'G09', 'linea',
   'e0000000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000004', 1, 'A1',
   'e0000000-0000-0000-0000-0000000000a1'),
  ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000004', 2, 'A2',
   'e0000000-0000-0000-0000-0000000000a1');

-- Trees existentes pero ninguno con global_id todavía.
select is(
  ( select total from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  2, 'plantation_ids_status.total = 2 con trees sin id'
);
select is(
  ( select con_id from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  0, 'plantation_ids_status.con_id = 0 con trees sin id'
);
select is(
  ( select generados from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  false, 'plantation_ids_status.generados false con trees sin id'
);

set local role authenticated;

-- Tecnico: gate por rol global, igual que antes del refactor (04).
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-0000000000a2', true);
select is(
  ( select generate_tree_ids('e0000000-0000-0000-0000-000000000002'::uuid) ->> 'error' ),
  'NOT_AUTHORIZED',
  'generate_tree_ids sigue rechazando a un tecnico tras el refactor'
);

-- Admin: éxito, forma de payload sin cambios.
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-0000000000a1', true);
select is(
  ( select generate_tree_ids('e0000000-0000-0000-0000-000000000002'::uuid) ->> 'success' ),
  'true', 'generate_tree_ids sigue devolviendo success tras el refactor'
);
select is(
  ( select generate_tree_ids('e0000000-0000-0000-0000-000000000002'::uuid) ->> 'error' ),
  'ALREADY_GENERATED', 'segunda corrida devuelve ALREADY_GENERATED'
);

-- Status refleja los ids ya generados.
select is(
  ( select total from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  2, 'plantation_ids_status.total = 2 tras generar'
);
select is(
  ( select con_id from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  2, 'plantation_ids_status.con_id = 2 tras generar'
);
select is(
  ( select generados from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  true, 'plantation_ids_status.generados true tras generar'
);

-- Seed avanza al usar el MAX(global_id) real de la tabla.
select is(
  ( select next_global_id_seed() ),
  ( select max(global_id) + 1 from trees where group_id = 'e0000000-0000-0000-0000-000000000004' ),
  'next_global_id_seed = MAX(global_id) + 1 con trees ya generados'
);

-- RLS de SELECT en groups/trees es USING(true) hoy (hasta #310): un no-miembro
-- autenticado igual puede leer el status, aunque no pueda generar ids.
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-0000000000a3', true);
select is(
  ( select count(*)::int from plantation_ids_status('e0000000-0000-0000-0000-000000000002'::uuid) ),
  1, 'plantation_ids_status devuelve una fila para un no-miembro autenticado'
);

select * from finish();
rollback;
