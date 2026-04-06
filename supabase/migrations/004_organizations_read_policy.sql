-- Migration 004: Allow authenticated users to read organizations
-- The organizations table had RLS enabled (migration 001) but no SELECT policy,
-- which caused the profile screen to never display the organization name.

create policy "Authenticated users can read organizations"
  on organizations for select
  to authenticated
  using (true);
