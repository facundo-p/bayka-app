-- sync_subgroup pisa codigo y nombre de un grupo existente, y normaliza el
-- prefijo de parcela de los SubID con el `parcela_codigo` que manda el móvil
-- (054, #626).
begin;
select plan(7);

insert into organizations (id, nombre) values
  ('b3200000-0000-0000-0000-000000000001', 'Org Test 32');

insert into auth.users (id, email) values
  ('b3200000-0000-0000-0000-0000000000a1', 'tecnico-32@test.local');

update profiles set organizacion_id = 'b3200000-0000-0000-0000-000000000001'
  where id = 'b3200000-0000-0000-0000-0000000000a1';

insert into plantations (id, organizacion_id, lugar, periodo, creado_por, estado) values
  ('b3200000-0000-0000-0000-000000000002', 'b3200000-0000-0000-0000-000000000001',
   'Activa 32', '2026', 'b3200000-0000-0000-0000-0000000000a1', 'activa');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('b3200000-0000-0000-0000-000000000002', 'b3200000-0000-0000-0000-0000000000a1', 'tecnico');

-- En el server la parcela ya es P9; el móvil todavía la conoce como P1.
insert into parcelas (id, plantation_id, nombre, codigo) values
  ('b3200000-0000-0000-0000-0000000000b1', 'b3200000-0000-0000-0000-000000000002', 'Norte', 'P9');

insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, usuario_creador) values
  ('b3200000-0000-0000-0000-0000000000c1', 'b3200000-0000-0000-0000-000000000002',
   'b3200000-0000-0000-0000-0000000000b1', 'Uno', 'L1', 'linea', 'b3200000-0000-0000-0000-0000000000a1');

create temp table grupo_32 as select jsonb_build_object(
  'id', 'b3200000-0000-0000-0000-0000000000c1',
  'plantation_id', 'b3200000-0000-0000-0000-000000000002',
  'parcela_id', 'b3200000-0000-0000-0000-0000000000b1',
  'nombre', 'Uno bis', 'codigo', 'L7', 'tipo', 'linea', 'estado', 'activa',
  'usuario_creador', 'b3200000-0000-0000-0000-0000000000a1',
  'created_at', now()
) as g;
grant select on grupo_32 to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b3200000-0000-0000-0000-0000000000a1', true);

-- El grupo se renombró L1 → L7 y sus árboles se armaron con la parcela P1.
select is(
  ( select sync_subgroup(
      (select g from grupo_32) || jsonb_build_object('parcela_codigo', 'P1'),
      jsonb_build_array(
        jsonb_build_object('id', 'b3200000-0000-0000-0000-0000000000d1',
          'subgroup_id', 'b3200000-0000-0000-0000-0000000000c1', 'posicion', 1,
          'sub_id', 'P1L7EUC1', 'usuario_registro', 'b3200000-0000-0000-0000-0000000000a1',
          'created_at', now()),
        -- Empieza con `P1` pero no con `P1L7`: no es un prefijo de esta parcela.
        jsonb_build_object('id', 'b3200000-0000-0000-0000-0000000000d2',
          'subgroup_id', 'b3200000-0000-0000-0000-0000000000c1', 'posicion', 2,
          'sub_id', 'P10L7NN2', 'usuario_registro', 'b3200000-0000-0000-0000-0000000000a1',
          'created_at', now())
      )
    ) ->> 'success' ),
  'true',
  'sync_subgroup acepta el grupo renombrado'
);

-- Un cliente sin `parcela_codigo` sube el SubID como viene.
select is(
  ( select sync_subgroup(
      (select g from grupo_32),
      jsonb_build_array(
        jsonb_build_object('id', 'b3200000-0000-0000-0000-0000000000d3',
          'subgroup_id', 'b3200000-0000-0000-0000-0000000000c1', 'posicion', 3,
          'sub_id', 'P1L7NN3', 'usuario_registro', 'b3200000-0000-0000-0000-0000000000a1',
          'created_at', now())
      )
    ) ->> 'success' ),
  'true',
  'sync_subgroup acepta un cliente que no manda parcela_codigo'
);

reset role;

select is((select codigo from groups where id = 'b3200000-0000-0000-0000-0000000000c1'),
  'L7', 'el grupo adopta el código nuevo');
select is((select nombre from groups where id = 'b3200000-0000-0000-0000-0000000000c1'),
  'Uno bis', 'y el nombre nuevo');
select is((select sub_id from trees where id = 'b3200000-0000-0000-0000-0000000000d1'),
  'P9L7EUC1', 'el SubID armado con el código viejo de la parcela pasa al vigente');
select is((select sub_id from trees where id = 'b3200000-0000-0000-0000-0000000000d2'),
  'P10L7NN2', 'un SubID que no empieza con parcela + grupo queda como vino');
select is((select sub_id from trees where id = 'b3200000-0000-0000-0000-0000000000d3'),
  'P1L7NN3', 'sin parcela_codigo no se normaliza');

select * from finish();
rollback;
