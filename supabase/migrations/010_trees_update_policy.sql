-- Migration 010: Add UPDATE policy on trees table
-- Allows any user assigned to the plantation to update trees.
-- Required for: (a) uploadPendingPhotos updating foto_url after Storage upload,
-- (b) cross-user N/N resolution (user B resolves N/N on user A's tree via sync).
-- Uses plantation_users join to verify the user is assigned to the plantation.

CREATE POLICY "Plantation members can update trees"
ON trees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM subgroups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = trees.subgroup_id
    AND pu.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM subgroups sg
    JOIN plantation_users pu ON pu.plantation_id = sg.plantation_id
    WHERE sg.id = trees.subgroup_id
    AND pu.user_id = auth.uid()
  )
);
