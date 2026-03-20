-- Migration 003: Admin RLS policies for plantation management operations
-- Admin users (rol = 'admin') require INSERT/UPDATE/DELETE policies on
-- plantations, plantation_species, plantation_users, and SELECT on org profiles.

-- ─── plantations ─────────────────────────────────────────────────────────────

-- Admin can insert plantations (creating new plantations)
create policy "Admin can insert plantations"
  on plantations for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can update plantations (finalization — setting estado = 'finalizada')
create policy "Admin can update plantations"
  on plantations for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- ─── plantation_species ───────────────────────────────────────────────────────

-- Admin can insert plantation_species (adding species to a plantation)
create policy "Admin can insert plantation_species"
  on plantation_species for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can delete plantation_species (removing species from a plantation)
create policy "Admin can delete plantation_species"
  on plantation_species for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can update plantation_species (updating orden_visual)
create policy "Admin can update plantation_species"
  on plantation_species for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- ─── plantation_users ─────────────────────────────────────────────────────────

-- Admin can insert plantation_users (assigning technicians to a plantation)
create policy "Admin can insert plantation_users"
  on plantation_users for insert
  to authenticated
  with check (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- Admin can delete plantation_users (unassigning technicians from a plantation)
create policy "Admin can delete plantation_users"
  on plantation_users for delete
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
  );

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Admin can read all profiles in their organization (for technician assignment list)
-- Existing policy only allows users to read their own profile.
-- This adds org-wide read for admins to list all technicians in the same org.
create policy "Admin can read org profiles"
  on profiles for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.rol = 'admin'
        and p.organizacion_id = profiles.organizacion_id
    )
  );
