-- contracts/permisos-edicion.json contra el server (#735): cada caso de `web`
-- contra cambiar_especie_arbol y editar_plantacion, y cada caso de `app` contra
-- sync_subgroup. La web y la app recorren la misma tabla contra sus predicados.
begin;
select plan(
  2
  + 2 * jsonb_array_length(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos')
  + jsonb_array_length(tests.contrato('permisos-edicion.json') -> 'app' -> 'casos')
);

insert into organizations (id, nombre) values
  ('b4600000-0000-0000-0000-000000000001', 'Org Test 46');

create temp table usuarios_46 (id uuid primary key, rol text, activo boolean);
insert into usuarios_46 values
  ('b4600000-0000-0000-0000-0000000000a1', 'tecnico', true),
  ('b4600000-0000-0000-0000-0000000000a2', 'tecnico', false),
  ('b4600000-0000-0000-0000-0000000000a3', 'admin', true),
  ('b4600000-0000-0000-0000-0000000000a4', 'admin', false),
  ('b4600000-0000-0000-0000-0000000000a5', 'superadmin', true),
  ('b4600000-0000-0000-0000-0000000000a6', 'superadmin', false);

insert into auth.users (id, email)
select id, 'usuario-' || right(id::text, 2) || '-46@test.local' from usuarios_46;
update profiles p set rol = u.rol, organizacion_id = 'b4600000-0000-0000-0000-000000000001'
  from usuarios_46 u where p.id = u.id;

create temp table plantaciones_46 (
  estado text, archivada boolean, plantacion uuid, parcela uuid, grupo uuid, arbol uuid
);
insert into plantaciones_46
select e.estado, a.archivada, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  from (values ('activa'), ('finalizada')) as e(estado)
  cross join (values (false), (true)) as a(archivada);

select tests.crear_plantacion(plantacion, 'b4600000-0000-0000-0000-000000000001',
  'b4600000-0000-0000-0000-0000000000a3', p_estado => estado)
  from plantaciones_46;

insert into species (id, codigo, nombre) values
  ('b4600000-0000-0000-0000-0000000000e1', 'T46A', 'Alamo 46'),
  ('b4600000-0000-0000-0000-0000000000e2', 'T46B', 'Ceibo 46');
insert into plantation_species (plantation_id, species_id, orden_visual)
select p.plantacion, s.id, 0
  from plantaciones_46 p
  cross join species s where s.codigo in ('T46A', 'T46B');

-- Los técnicos, asignados: el rechazo es por el rol o el estado, no por membresía.
insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
select p.plantacion, u.id, 'tecnico'
  from plantaciones_46 p cross join usuarios_46 u where u.rol = 'tecnico'
on conflict (plantation_id, user_id) do nothing;

insert into parcelas (id, plantation_id, nombre, codigo)
select parcela, plantacion, 'Norte', 'P1' from plantaciones_46;
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador)
select grupo, plantacion, parcela, 'Uno', 'L1', 'linea', 'activa', 'b4600000-0000-0000-0000-0000000000a1'
  from plantaciones_46;
insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro)
select arbol, grupo, 'b4600000-0000-0000-0000-0000000000e1', 1, 'P1L1T46A1', 'b4600000-0000-0000-0000-0000000000a1'
  from plantaciones_46;

-- Archivar y desactivar al final, como pasa de verdad: con el resto ya cargado.
update plantations p set archivada_en = now(), archivada_por = 'b4600000-0000-0000-0000-0000000000a3'
  from plantaciones_46 x where p.id = x.plantacion and x.archivada;
select set_config('request.jwt.claim.sub', '', true);
update profiles p set activo = false from usuarios_46 u where p.id = u.id and not u.activo;

-- La especie a la que se cambia es siempre la otra: un cambio aplicado no deja
-- conflicto para el caso siguiente sobre el mismo árbol.
create function pg_temp.otra_especie(p_arbol uuid) returns uuid language sql as $$
  select case when species_id = 'b4600000-0000-0000-0000-0000000000e1'
              then 'b4600000-0000-0000-0000-0000000000e2'::uuid
              else 'b4600000-0000-0000-0000-0000000000e1'::uuid end
    from trees where id = p_arbol;
$$;

create function pg_temp.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_usuario::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.cambia_especie(p_usuario uuid, p_arbol uuid) returns boolean language plpgsql as $$
declare
  v_actual uuid := (select species_id from trees where id = p_arbol);
  v_otra uuid := pg_temp.otra_especie(p_arbol);
  v_resultado jsonb;
begin
  perform pg_temp.como(p_usuario);
  v_resultado := cambiar_especie_arbol(p_arbol, v_otra, v_actual);
  reset role;
  return (v_resultado ->> 'success')::boolean;
end;
$$;

create function pg_temp.edita_plantacion(p_usuario uuid, p_plantacion uuid) returns boolean language plpgsql as $$
declare
  v_lugar text := (select lugar from plantations where id = p_plantacion);
  v_resultado jsonb;
begin
  perform pg_temp.como(p_usuario);
  v_resultado := editar_plantacion(p_plantacion,
    jsonb_build_object('lugar', case when v_lugar = 'Lugar A' then 'Lugar B' else 'Lugar A' end),
    jsonb_build_object('lugar', v_lugar));
  reset role;
  return (v_resultado ->> 'success')::boolean;
end;
$$;

-- El técnico activo que creó el grupo sube el árbol con la otra especie.
create function pg_temp.sube_cambio(p plantaciones_46) returns boolean language plpgsql as $$
declare
  v_actual uuid := (select species_id from trees where id = p.arbol);
  v_otra uuid := pg_temp.otra_especie(p.arbol);
  v_resultado jsonb;
begin
  perform pg_temp.como('b4600000-0000-0000-0000-0000000000a1');
  v_resultado := sync_subgroup(
    jsonb_build_object(
      'id', p.grupo, 'plantation_id', p.plantacion, 'parcela_id', p.parcela,
      'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'activa',
      'usuario_creador', 'b4600000-0000-0000-0000-0000000000a1',
      'created_at', now(), 'parcela_codigo', 'P1'),
    jsonb_build_array(jsonb_build_object(
      'id', p.arbol, 'subgroup_id', p.grupo, 'posicion', 1,
      'sub_id', 'P1L1' || (select codigo from species where id = v_otra) || '1',
      'species_id', v_otra, 'species_base_id', v_actual,
      'usuario_registro', 'b4600000-0000-0000-0000-0000000000a1', 'created_at', now())));
  reset role;
  return (v_resultado ->> 'success')::boolean;
end;
$$;

create function pg_temp.caso(c jsonb) returns text language sql as $$
  select concat_ws(' ', c ->> 'rol', case (c ->> 'activo')::boolean when false then 'inactivo' end,
    c ->> 'estado', case when (c ->> 'archivada')::boolean then 'archivada' end,
    case when (c ->> 'permitido')::boolean then 'puede' else 'no puede' end);
$$;

select ok(jsonb_array_length(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos') > 0,
  'el contrato trae casos de la web');
select ok(jsonb_array_length(tests.contrato('permisos-edicion.json') -> 'app' -> 'casos') > 0,
  'el contrato trae casos de la app');

-- Un caso sin usuario o plantación que calce no corre, y el plan lo detecta.
select is(pg_temp.cambia_especie(u.id, p.arbol), (c ->> 'permitido')::boolean,
          'cambiar_especie_arbol: ' || pg_temp.caso(c))
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos') as c
  join usuarios_46 u on u.rol = c ->> 'rol' and u.activo = (c ->> 'activo')::boolean
  join plantaciones_46 p on p.estado = c ->> 'estado' and p.archivada = (c ->> 'archivada')::boolean;

select is(pg_temp.edita_plantacion(u.id, p.plantacion), (c ->> 'permitido')::boolean,
          'editar_plantacion: ' || pg_temp.caso(c))
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos') as c
  join usuarios_46 u on u.rol = c ->> 'rol' and u.activo = (c ->> 'activo')::boolean
  join plantaciones_46 p on p.estado = c ->> 'estado' and p.archivada = (c ->> 'archivada')::boolean;

select is(pg_temp.sube_cambio(p), (c ->> 'permitido')::boolean,
          'sync_subgroup del técnico creador: ' || pg_temp.caso(c))
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'app' -> 'casos') as c
  join plantaciones_46 p on p.estado = c ->> 'estado' and p.archivada = (c ->> 'archivada')::boolean;

select * from finish();
rollback;
