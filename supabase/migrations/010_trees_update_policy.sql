-- Migration 010: Add UPDATE policy on trees table
-- Without this, uploadPendingPhotos silently fails when updating foto_url
-- because RLS blocks the UPDATE (no policy existed for UPDATE on trees).

CREATE POLICY "Users can update own trees"
ON trees FOR UPDATE
TO authenticated
USING (auth.uid() = usuario_registro)
WITH CHECK (auth.uid() = usuario_registro);
