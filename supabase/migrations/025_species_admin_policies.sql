-- Migration 025: políticas RLS de escritura sobre species para la web (issue #204)
--
-- Contexto: species es el catálogo global compartido (001_initial_schema.sql).
-- Tenía RLS habilitado pero SOLO con policy de SELECT para authenticated; no
-- existía ninguna policy de INSERT/UPDATE. La web de gestión ahora permite dar
-- de alta y editar especies (issue #204), pero sin estas policies toda mutación
-- falla con insufficient_privilege (42501).
--
-- Se agregan INSERT y UPDATE restringidas a admin/superadmin, con el MISMO
-- cuerpo que el resto de las políticas de escritura de la web (ver 024_web_admin
-- y 003/021). No se agrega DELETE: el catálogo es referenciado por
-- plantation_species y trees (species_id), borrar una especie en uso rompería
-- integridad; la baja no es parte del alcance de #204.
--
-- Nota: species es un catálogo GLOBAL. Crear/editar desde la web afecta a todas
-- las organizaciones y a la Bayka App mobile.

create policy "Admin can insert species" on species
  for insert to authenticated
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));

create policy "Admin can update species" on species
  for update to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ))
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and rol in ('admin', 'superadmin')
  ));
