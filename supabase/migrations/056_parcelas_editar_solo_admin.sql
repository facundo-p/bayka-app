-- Editar y borrar parcelas queda para admin y superadmin (#640). Crear sigue
-- abierto a cualquier miembro: el técnico arma parcelas en campo.
--
-- El borrado es un tombstone (`UPDATE parcelas SET deleted_at`) y no hay policy
-- de DELETE (051), así que esta policy cubre las dos cosas. El upsert del móvil
-- (`ON CONFLICT DO UPDATE`) pasa por acá solo cuando la fila ya existe.

DROP POLICY IF EXISTS "Plantation members can update parcelas" ON "public"."parcelas";
DROP POLICY IF EXISTS "Admins can update parcelas" ON "public"."parcelas";
CREATE POLICY "Admins can update parcelas" ON "public"."parcelas"
  FOR UPDATE TO "authenticated"
  USING (
    is_admin()
    AND is_plantation_member(parcelas.plantation_id)
    AND plantacion_escribible(parcelas.plantation_id)
  )
  WITH CHECK (
    is_admin()
    AND is_plantation_member(parcelas.plantation_id)
    AND plantacion_escribible(parcelas.plantation_id)
  );
