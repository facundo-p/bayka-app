-- Cambiar el código de una parcela reescribe el prefijo del SubID de sus
-- árboles (053, #623). Se prueba por el camino del móvil: upsert de la parcela
-- como admin miembro, bajo RLS (editar parcelas es de admin desde 056, #640).
begin;
select plan(8);

insert into organizations (id, nombre) values
  ('b3100000-0000-0000-0000-000000000001', 'Org Test 31');

insert into auth.users (id, email) values
  ('b3100000-0000-0000-0000-0000000000a1', 'tecnico-31@test.local'),
  ('b3100000-0000-0000-0000-0000000000a2', 'admin-31@test.local');

update profiles set organizacion_id = 'b3100000-0000-0000-0000-000000000001'
  where id = 'b3100000-0000-0000-0000-0000000000a1';
update profiles set rol = 'admin', organizacion_id = 'b3100000-0000-0000-0000-000000000001'
  where id = 'b3100000-0000-0000-0000-0000000000a2';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('b3100000-0000-0000-0000-000000000002', 'b3100000-0000-0000-0000-000000000001',
   'Activa 31', '2026', 'b3100000-0000-0000-0000-0000000000a2', 'activa'),
  ('b3100000-0000-0000-0000-000000000003', 'b3100000-0000-0000-0000-000000000001',
   'Finalizada 31', '2026', 'b3100000-0000-0000-0000-0000000000a2', 'finalizada');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b3100000-0000-0000-0000-000000000002', 'b3100000-0000-0000-0000-0000000000a1', 'tecnico'),
  ('b3100000-0000-0000-0000-000000000003', 'b3100000-0000-0000-0000-0000000000a1', 'tecnico');

-- P1 cambia de código; Q1 es otra parcela de la misma plantación; P3 está en la finalizada.
insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3100000-0000-0000-0000-0000000000b1', 'b3100000-0000-0000-0000-000000000002', 'Norte', 'P1'),
  ('b3100000-0000-0000-0000-0000000000b2', 'b3100000-0000-0000-0000-000000000002', 'Sur', 'Q1'),
  ('b3100000-0000-0000-0000-0000000000b3', 'b3100000-0000-0000-0000-000000000003', 'Este', 'P3');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b3100000-0000-0000-0000-0000000000c1', 'b3100000-0000-0000-0000-000000000002',
   'b3100000-0000-0000-0000-0000000000b1', 'Uno', 'L1', 'linea', 'b3100000-0000-0000-0000-0000000000a1'),
  ('b3100000-0000-0000-0000-0000000000c2', 'b3100000-0000-0000-0000-000000000002',
   'b3100000-0000-0000-0000-0000000000b1', 'Dos', 'L2', 'linea', 'b3100000-0000-0000-0000-0000000000a1'),
  ('b3100000-0000-0000-0000-0000000000c3', 'b3100000-0000-0000-0000-000000000002',
   'b3100000-0000-0000-0000-0000000000b2', 'Uno', 'L1', 'linea', 'b3100000-0000-0000-0000-0000000000a1'),
  ('b3100000-0000-0000-0000-0000000000c4', 'b3100000-0000-0000-0000-000000000003',
   'b3100000-0000-0000-0000-0000000000b3', 'Uno', 'L1', 'linea', 'b3100000-0000-0000-0000-0000000000a1');

insert into trees (id, group_id, posicion, sub_id, usuario_registro) values
  ('b3100000-0000-0000-0000-0000000000d1', 'b3100000-0000-0000-0000-0000000000c1', 1, 'P1L1EUC1',
   'b3100000-0000-0000-0000-0000000000a1'),
  ('b3100000-0000-0000-0000-0000000000d2', 'b3100000-0000-0000-0000-0000000000c2', 1, 'P1L2NN1',
   'b3100000-0000-0000-0000-0000000000a1'),
  ('b3100000-0000-0000-0000-0000000000d3', 'b3100000-0000-0000-0000-0000000000c1', 2, 'RARO2',
   'b3100000-0000-0000-0000-0000000000a1'),
  ('b3100000-0000-0000-0000-0000000000d4', 'b3100000-0000-0000-0000-0000000000c3', 1, 'Q1L1EUC1',
   'b3100000-0000-0000-0000-0000000000a1'),
  ('b3100000-0000-0000-0000-0000000000d5', 'b3100000-0000-0000-0000-0000000000c4', 1, 'P3L1EUC1',
   'b3100000-0000-0000-0000-0000000000a1'),
  -- Empieza con `P1` pero no con `P1L1`: con el filtro corto terminaría en `P90L1…`.
  ('b3100000-0000-0000-0000-0000000000d6', 'b3100000-0000-0000-0000-0000000000c1', 3, 'P10L1EUC3',
   'b3100000-0000-0000-0000-0000000000a1'),
  -- El grupo se renombró a L7 en el móvil, pero el server sigue con L2 (#626).
  ('b3100000-0000-0000-0000-0000000000d7', 'b3100000-0000-0000-0000-0000000000c2', 2, 'P1L7NN2',
   'b3100000-0000-0000-0000-0000000000a1');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3100000-0000-0000-0000-0000000000a2', true);

-- Upsert completo, como `uploadParcela` del móvil.
insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3100000-0000-0000-0000-0000000000b1', 'b3100000-0000-0000-0000-000000000002', 'Norte bis', 'P9')
on conflict (id) do update set nombre = excluded.nombre, codigo = excluded.codigo;

-- La finalizada: la policy rechaza el UPDATE y el trigger no llega a correr.
update parcelas set codigo = 'P8' where id = 'b3100000-0000-0000-0000-0000000000b3';

reset role;

select is((select sub_id from trees where id = 'b3100000-0000-0000-0000-0000000000d1'),
  'P9L1EUC1', 'reescribe el prefijo en el primer grupo de la parcela');
select is((select sub_id from trees where id = 'b3100000-0000-0000-0000-0000000000d2'),
  'P9L2NN1', 'y en el segundo');
select is((select sub_id from trees where id = 'b3100000-0000-0000-0000-0000000000d3'),
  'RARO2', 'un SubID que no empieza con el código viejo queda como estaba');
select is((select sub_id from trees where id = 'b3100000-0000-0000-0000-0000000000d4'),
  'Q1L1EUC1', 'otra parcela de la plantación no se toca');
select is((select sub_id from trees where id = 'b3100000-0000-0000-0000-0000000000d6'),
  'P10L1EUC3', 'un SubID que empieza con el código de parcela pero no con parcela + grupo no se toca');
select is((select sub_id from trees where id = 'b3100000-0000-0000-0000-0000000000d7'),
  'P1L7NN2', 'con el código de grupo del server desactualizado, el árbol queda como estaba');
select is((select codigo from parcelas where id = 'b3100000-0000-0000-0000-0000000000b3'),
  'P3', 'el admin no cambia el código de una parcela de una plantación finalizada');
select is((select sub_id from trees where id = 'b3100000-0000-0000-0000-0000000000d5'),
  'P3L1EUC1', 'ni sus SubID');

select * from finish();
rollback;
