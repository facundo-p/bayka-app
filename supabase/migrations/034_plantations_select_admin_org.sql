-- Migration 034: admin/superadmin leen las plantaciones de su organización sin
-- esperar la membresía (#379). Con INSERT … RETURNING la policy SELECT se
-- evalúa antes de que trg_add_admin_memberships (AFTER INSERT) sume al
-- creador, y la 033 rechazaba el alta con 42501. Es la misma visibilidad que
-- ya da ese trigger, adelantada.

DROP POLICY IF EXISTS "Members can read plantations" ON "public"."plantations";
DROP POLICY IF EXISTS "Members and org admins can read plantations" ON "public"."plantations";
CREATE POLICY "Members and org admins can read plantations" ON "public"."plantations"
  FOR SELECT TO "authenticated"
  USING (is_plantation_member(id) OR (is_admin() AND organizacion_id = current_organizacion_id()));
