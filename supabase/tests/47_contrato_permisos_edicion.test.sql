-- contracts/permisos-edicion.json contra el server (#735): cada caso de `web`
-- contra cambiar_especie_arbol y editar_plantacion, y cada caso de `app` contra
-- sync_subgroup. La web y la app recorren la misma tabla contra sus predicados.
begin;
select plan(
  4
  + 2 * jsonb_array_length(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos')
  + jsonb_array_length(tests.contrato('permisos-edicion.json') -> 'app' -> 'casos')
);

insert into organizations (id, nombre) values
  ('b4700000-0000-0000-0000-000000000001', 'Org Test 47');

create temp table usuarios_47 (id uuid primary key, rol text, activo boolean);
insert into usuarios_47 values
  ('b4700000-0000-0000-0000-0000000000a1', 'tecnico', true),
  ('b4700000-0000-0000-0000-0000000000a2', 'tecnico', false),
  ('b4700000-0000-0000-0000-0000000000a3', 'admin', true),
  ('b4700000-0000-0000-0000-0000000000a4', 'admin', false),
  ('b4700000-0000-0000-0000-0000000000a5', 'superadmin', true),
  ('b4700000-0000-0000-0000-0000000000a6', 'superadmin', false);

insert into auth.users (id, email)
select id, 'usuario-' || right(id::text, 2) || '-47@test.local' from usuarios_47;
update profiles p set rol = u.rol, organizacion_id = 'b4700000-0000-0000-0000-000000000001'
  from usuarios_47 u where p.id = u.id;

create temp table plantaciones_47 (
  estado text, archivada boolean, plantacion uuid, parcela uuid, grupo uuid, arbol uuid
);
insert into plantaciones_47
select e.estado, a.archivada, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  from (values ('activa'), ('finalizada')) as e(estado)
  cross join (values (false), (true)) as a(archivada);

select tests.crear_plantacion(plantacion, 'b4700000-0000-0000-0000-000000000001',
  'b4700000-0000-0000-0000-0000000000a3', p_estado => estado)
  from plantaciones_47;

insert into species (id, codigo, nombre) values
  ('b4700000-0000-0000-0000-0000000000e1', 'T47A', 'Alamo 47'),
  ('b4700000-0000-0000-0000-0000000000e2', 'T47B', 'Ceibo 47');
insert into plantation_species (plantation_id, species_id, orden_visual)
select p.plantacion, s.id, 0
  from plantaciones_47 p
  cross join species s where s.codigo in ('T47A', 'T47B');

-- Los técnicos, asignados: el rechazo es por el rol o el estado, no por membresía.
insert into plantation_users (plantation_id, user_id, rol_en_plantacion)
select p.plantacion, u.id, 'tecnico'
  from plantaciones_47 p cross join usuarios_47 u where u.rol = 'tecnico'
on conflict (plantation_id, user_id) do nothing;

insert into parcelas (id, plantation_id, nombre, codigo)
select parcela, plantacion, 'Norte', 'P1' from plantaciones_47;
insert into groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador)
select grupo, plantacion, parcela, 'Uno', 'L1', 'linea', 'activa', 'b4700000-0000-0000-0000-0000000000a1'
  from plantaciones_47;
insert into trees (id, group_id, species_id, posicion, sub_id, usuario_registro)
select arbol, grupo, 'b4700000-0000-0000-0000-0000000000e1', 1, 'P1L1T47A1', 'b4700000-0000-0000-0000-0000000000a1'
  from plantaciones_47;

-- Archivar y desactivar al final, como pasa de verdad: con el resto ya cargado.
update plantations p set archivada_en = now(), archivada_por = 'b4700000-0000-0000-0000-0000000000a3'
  from plantaciones_47 x where p.id = x.plantacion and x.archivada;
select set_config('request.jwt.claim.sub', '', true);
update profiles p set activo = false from usuarios_47 u where p.id = u.id and not u.activo;

-- La especie a la que se cambia es siempre la otra: un cambio aplicado no deja
-- conflicto para el caso siguiente sobre el mismo árbol.
create function pg_temp.otra_especie(p_arbol uuid) returns uuid language sql as $$
  select case when species_id = 'b4700000-0000-0000-0000-0000000000e1'
              then 'b4700000-0000-0000-0000-0000000000e2'::uuid
              else 'b4700000-0000-0000-0000-0000000000e1'::uuid end
    from trees where id = p_arbol;
$$;

-- Un rechazo cuenta solo si es del gate: un payload roto o una especie no
-- habilitada también dan success false, y harían pasar los casos rechazados.
create function pg_temp.desenlace(p_resultado jsonb) returns text language sql as $$
  select case
    when (p_resultado ->> 'success')::boolean then 'permitido'
    when p_resultado ->> 'error' in ('NOT_AUTHORIZED', 'PERMISSION', 'PLANTACION_FINALIZADA', 'PLANTACION_ARCHIVADA')
      then 'rechazado'
    else p_resultado ->> 'error'
  end;
$$;

create function pg_temp.esperado(c jsonb) returns text language sql as $$
  select case when (c ->> 'permitido')::boolean then 'permitido' else 'rechazado' end;
$$;

create function pg_temp.como(p_usuario uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_usuario::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.cambia_especie(p_usuario uuid, p_arbol uuid) returns text language plpgsql as $$
declare
  v_actual uuid := (select species_id from trees where id = p_arbol);
  v_otra uuid := pg_temp.otra_especie(p_arbol);
  v_resultado jsonb;
begin
  perform pg_temp.como(p_usuario);
  v_resultado := cambiar_especie_arbol(p_arbol, v_otra, v_actual);
  reset role;
  return pg_temp.desenlace(v_resultado);
end;
$$;

create function pg_temp.edita_plantacion(p_usuario uuid, p_plantacion uuid) returns text language plpgsql as $$
declare
  v_lugar text := (select lugar from plantations where id = p_plantacion);
  v_resultado jsonb;
begin
  perform pg_temp.como(p_usuario);
  v_resultado := editar_plantacion(p_plantacion,
    jsonb_build_object('lugar', case when v_lugar = 'Lugar A' then 'Lugar B' else 'Lugar A' end),
    jsonb_build_object('lugar', v_lugar));
  reset role;
  return pg_temp.desenlace(v_resultado);
end;
$$;

-- El técnico activo que creó el grupo sube el árbol con la otra especie.
create function pg_temp.sube_cambio(p plantaciones_47) returns text language plpgsql as $$
declare
  v_actual uuid := (select species_id from trees where id = p.arbol);
  v_otra uuid := pg_temp.otra_especie(p.arbol);
  v_resultado jsonb;
begin
  perform pg_temp.como('b4700000-0000-0000-0000-0000000000a1');
  v_resultado := sync_subgroup(
    jsonb_build_object(
      'id', p.grupo, 'plantation_id', p.plantacion, 'parcela_id', p.parcela,
      'nombre', 'Uno', 'codigo', 'L1', 'tipo', 'linea', 'estado', 'activa',
      'usuario_creador', 'b4700000-0000-0000-0000-0000000000a1',
      'created_at', now(), 'parcela_codigo', 'P1'),
    jsonb_build_array(jsonb_build_object(
      'id', p.arbol, 'subgroup_id', p.grupo, 'posicion', 1,
      'sub_id', 'P1L1' || (select codigo from species where id = v_otra) || '1',
      'species_id', v_otra, 'species_base_id', v_actual,
      'usuario_registro', 'b4700000-0000-0000-0000-0000000000a1', 'created_at', now())));
  reset role;
  return pg_temp.desenlace(v_resultado);
end;
$$;

create function pg_temp.caso(c jsonb) returns text language sql as $$
  select concat_ws(' ', c ->> 'rol', case (c ->> 'activo')::boolean when false then 'inactivo' end,
    c ->> 'estado', case when (c ->> 'archivada')::boolean then 'archivada' end,
    case when (c ->> 'permitido')::boolean then 'puede' else 'no puede' end);
$$;

-- Una tabla recortada pasaría en todos los consumidores: cada una trae todas las
-- combinaciones de sus dimensiones, una vez, y casos de los dos desenlaces.
create temp table casos_web as
select c ->> 'rol' as rol, (c ->> 'activo')::boolean as activo, c ->> 'estado' as estado,
       (c ->> 'archivada')::boolean as archivada, (c ->> 'permitido')::boolean as permitido
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos') as c;
create temp table casos_app as
select c ->> 'estado' as estado, (c ->> 'archivada')::boolean as archivada, (c ->> 'permitido')::boolean as permitido
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'app' -> 'casos') as c;

select is((select count(distinct (rol, activo, estado, archivada))::int from casos_web),
  (select (count(distinct rol) * count(distinct activo) * count(distinct estado) * count(distinct archivada))::int
     from casos_web),
  'web: todas las combinaciones de rol, activo, estado y archivada');
select is((select count(distinct (estado, archivada))::int from casos_app),
  (select (count(distinct estado) * count(distinct archivada))::int from casos_app),
  'app: todas las combinaciones de estado y archivada');
select is((select count(*)::int from casos_web) + (select count(*)::int from casos_app),
  (select count(distinct (rol, activo, estado, archivada))::int from casos_web)
    + (select count(distinct (estado, archivada))::int from casos_app),
  'ningún caso repetido');
select ok((select bool_or(permitido) and not bool_and(permitido) from casos_web)
      and (select bool_or(permitido) and not bool_and(permitido) from casos_app),
  'las dos tablas traen casos permitidos y rechazados');

-- Un caso sin usuario o plantación que calce no corre, y el plan lo detecta.
select is(pg_temp.cambia_especie(u.id, p.arbol), pg_temp.esperado(c),
          'cambiar_especie_arbol: ' || pg_temp.caso(c))
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos') as c
  join usuarios_47 u on u.rol = c ->> 'rol' and u.activo = (c ->> 'activo')::boolean
  join plantaciones_47 p on p.estado = c ->> 'estado' and p.archivada = (c ->> 'archivada')::boolean;

select is(pg_temp.edita_plantacion(u.id, p.plantacion), pg_temp.esperado(c),
          'editar_plantacion: ' || pg_temp.caso(c))
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'web' -> 'casos') as c
  join usuarios_47 u on u.rol = c ->> 'rol' and u.activo = (c ->> 'activo')::boolean
  join plantaciones_47 p on p.estado = c ->> 'estado' and p.archivada = (c ->> 'archivada')::boolean;

select is(pg_temp.sube_cambio(p), pg_temp.esperado(c),
          'sync_subgroup del técnico creador: ' || pg_temp.caso(c))
  from jsonb_array_elements(tests.contrato('permisos-edicion.json') -> 'app' -> 'casos') as c
  join plantaciones_47 p on p.estado = c ->> 'estado' and p.archivada = (c ->> 'archivada')::boolean;

select * from finish();
rollback;
