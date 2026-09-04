-- Migration 011: Add INSERT policy for plantation members on trees table
-- Required for cross-user sync: when user B resolves an N/N tree created by
-- user A and syncs, the RPC does INSERT ... ON CONFLICT DO UPDATE.
-- PostgreSQL checks the INSERT policy BEFORE reaching ON CONFLICT.
-- Without this policy, user B's INSERT is blocked by RLS (original policy
-- requires auth.uid() = usuario_registro), and the RPC returns UNKNOWN error.

CREATE POLICY "Plantation members can insert trees"
ON trees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM subgroups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = subgroup_id
    AND pu.user_id = auth.uid()
  )
);
