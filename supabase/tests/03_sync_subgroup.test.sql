-- sync_subgroup (028): guard de membresía interno (SECURITY DEFINER bypassea
-- RLS, así que el chequeo vive en el body de la función, no en policies).
begin;
select plan(6);

insert into organizations (id, nombre) values
  ('c0000000-0000-0000-0000-000000000001', 'Org Test 03');

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-0000000000a1', 'miembro-03@test.local'),
  ('c0000000-0000-0000-0000-0000000000a2', 'outsider-03@test.local');

insert into plantations (id, organizacion_id, lugar, periodo, creado_por) values
  ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001',
   'Lugar Test 03', '2026', 'c0000000-0000-0000-0000-0000000000a1');

insert into parcelas (id, plantation_id, nombre, codigo) values
  ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002',
   'Parcela 03', 'P03');

insert into plantation_users (plantation_id, user_id, rol_en_plantacion) values
  ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000a1', 'tecnico');

set local role authenticated;

-- Non-member: PERMISSION, sin insertar nada.
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-0000000000a2', true);

select is(
  ( select sync_subgroup(
      jsonb_build_object(
        'id', 'c0000000-0000-0000-0000-000000000004',
        'plantation_id', 'c0000000-0000-0000-0000-000000000002',
        'parcela_id', 'c0000000-0000-0000-0000-000000000003',
        'nombre', 'G-outsider', 'codigo', 'G-OUT', 'tipo', 'linea', 'estado', 'activa',
        'usuario_creador', 'c0000000-0000-0000-0000-0000000000a2',
        'created_at', now()
      ),
      '[]'::jsonb
    ) ->> 'error' ),
  'PERMISSION',
  'sync_subgroup rechaza a un no-miembro con error PERMISSION'
);

select is(
  ( select count(*)::int from groups where id = 'c0000000-0000-0000-0000-000000000004' ),
  0,
  'sync_subgroup no insertó el grupo del no-miembro'
);

-- Member: happy path, inserta grupo + árboles.
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-0000000000a1', true);

select is(
  ( select sync_subgroup(
      jsonb_build_object(
        'id', 'c0000000-0000-0000-0000-000000000005',
        'plantation_id', 'c0000000-0000-0000-0000-000000000002',
        'parcela_id', 'c0000000-0000-0000-0000-000000000003',
        'nombre', 'G-miembro', 'codigo', 'G-MIEM', 'tipo', 'linea', 'estado', 'activa',
        'usuario_creador', 'c0000000-0000-0000-0000-0000000000a1',
        'created_at', now()
      ),
      jsonb_build_array(
        jsonb_build_object(
          'id', 'c0000000-0000-0000-0000-000000000006',
          'group_id', 'c0000000-0000-0000-0000-000000000005',
          'posicion', 1, 'sub_id', 'A1',
          'usuario_registro', 'c0000000-0000-0000-0000-0000000000a1',
          'created_at', now()
        )
      )
    ) ->> 'success' ),
  'true',
  'sync_subgroup acepta a un miembro'
);

select is(
  ( select estado from groups where id = 'c0000000-0000-0000-0000-000000000005' ),
  'activa',
  'el grupo del miembro quedó insertado con el estado del payload'
);

select is(
  ( select count(*)::int from trees where group_id = 'c0000000-0000-0000-0000-000000000005' ),
  1,
  'el árbol del payload quedó insertado'
);

-- Estado fuera del CHECK (ej. 'sincronizada', legado de mobile): cae a
-- 'finalizada', no lo rechaza ni lo inserta tal cual.
select sync_subgroup(
  jsonb_build_object(
    'id', 'c0000000-0000-0000-0000-000000000007',
    'plantation_id', 'c0000000-0000-0000-0000-000000000002',
    'parcela_id', 'c0000000-0000-0000-0000-000000000003',
    'nombre', 'G-sincronizada', 'codigo', 'G-SYNC', 'tipo', 'linea', 'estado', 'sincronizada',
    'usuario_creador', 'c0000000-0000-0000-0000-0000000000a1',
    'created_at', now()
  ),
  '[]'::jsonb
);

select is(
  ( select estado from groups where id = 'c0000000-0000-0000-0000-000000000007' ),
  'finalizada',
  'estado "sincronizada" del payload se guarda como "finalizada"'
);

select * from finish();
rollback;
