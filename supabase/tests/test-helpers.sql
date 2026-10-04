-- Funciones auxiliares de los tests pgTAP. run-db-tests.sh las carga como
-- última migración del proyecto temporal: nunca llegan a staging ni a prod.
-- Viven en su propio schema para no mezclarse con el de la app.

create schema if not exists tests;

-- Alta de una plantación con valores por defecto válidos (#711). El test pasa
-- solo lo que le importa; una columna obligatoria nueva se resuelve acá.
-- `codigo` sale de los últimos 8 caracteres hex del id: válido y distinto
-- dentro de una organización mientras los ids difieran al final.
-- SECURITY INVOKER a propósito: corre con los privilegios y la RLS de quien
-- llama, igual que el INSERT directo que reemplaza.
create or replace function tests.crear_plantacion(
  p_id uuid,
  p_organizacion_id uuid,
  p_creado_por uuid,
  p_lugar text default 'Plantación de prueba',
  p_periodo text default '2026',
  p_estado text default 'activa',
  p_codigo text default null,
  p_archivada_en timestamptz default null,
  p_objetivo_arboles integer default null
) returns uuid
  language sql
  as $$
  insert into public.plantations
    (id, organizacion_id, creado_por, lugar, periodo, estado, codigo, archivada_en, objetivo_arboles)
  values
    (p_id, p_organizacion_id, p_creado_por, p_lugar, p_periodo, p_estado,
     coalesce(p_codigo, upper(right(replace(p_id::text, '-', ''), 8))),
     p_archivada_en, p_objetivo_arboles)
  returning id;
$$;

-- Un contrato de contracts/. La tabla tests.contratos la crea y la llena
-- write_contracts_migration (lib.sh). Falla si no está: un contrato vacío
-- dejaría pasar un test sin casos.
create or replace function tests.contrato(p_nombre text) returns jsonb
  language plpgsql stable
  as $$
declare
  v_contenido jsonb;
begin
  select contenido into v_contenido from tests.contratos where nombre = p_nombre;
  if v_contenido is null then
    raise exception 'contrato % no cargado en tests.contratos', p_nombre;
  end if;
  return v_contenido;
end;
$$;
