-- Migration 021: Admin RLS policies for parcelas
--
-- Las parcelas (creadas en 012) solo tienen políticas de escritura por
-- membresía ("Plantation members can insert/update/delete parcelas", basadas en
-- EXISTS … plantation_users). A diferencia de plantations/plantation_species
-- (003), NO tienen una política por rol global admin.
--
-- Consecuencia (bug): un admin que crea una plantación NO es miembro de
-- plantation_users (la membresía solo se crea al asignar técnicos), así que el
-- upsert REST de su parcela es rechazado por RLS → pending_sync queda en true →
-- todos los grupos de esa parcela se bloquean con PARCELA_PENDING.
--
-- Fix: agregar políticas admin para parcelas, espejando 003. RLS es permisivo
-- (OR entre políticas): estas SUMAN a las member-based, no las reemplazan. Un
-- admin (profiles.rol='admin') o un miembro asignado pueden escribir.
--
-- La solución de fondo (membresía como única fuente de permisos) se sigue en el
-- issue #67; esta migración es el fix inmediato y consistente con el posture
-- actual de plantations/plantation_species.

BEGIN;

-- Admin can insert parcelas (creando parcelas en cualquier plantación)
create policy "Admin can insert parcelas"
  on parcelas for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can update parcelas (edición y tombstone vía upsert con deleted_at)
create policy "Admin can update parcelas"
  on parcelas for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can delete parcelas (hard delete; el cliente usa soft-delete vía update)
create policy "Admin can delete parcelas"
  on parcelas for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

COMMIT;
