-- Migration 031: DELETE en plantations para admin/superadmin (#300, opción A)
-- Rollback de creación online: si falla después de crear la plantación, hay
-- que poder borrar la fila remota; las FKs con ON DELETE CASCADE se llevan
-- puestas parcelas/grupos/árboles/plantation_users/plantation_species.

DROP POLICY IF EXISTS "Admin can delete plantations" ON public.plantations;
CREATE POLICY "Admin can delete plantations" ON public.plantations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.rol = ANY (ARRAY['admin'::text, 'superadmin'::text])
    )
  );
