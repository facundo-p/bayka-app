-- 030: hardening de seguridad e índices (#306, #307). Idempotente.
--  1. INSERT en groups/trees exigía solo ser el creador: cualquier authenticated podía escribir en
--     plantaciones ajenas. groups pasa al patrón creador + miembro; en trees se retira la policy
--     redundante (011 ya exige membresía y solo sync_subgroup inserta trees).
--  2. update_tree_ids (020) sin callers, reemplazado por generate_tree_ids (029).
--  3. search_path fijo en las SECURITY DEFINER que no lo tenían (026/027 ya lo fijan en las suyas).
--  4. Índices de FK usados por policies, stats y generate_tree_ids.
--  5. groups.parcela_id NOT NULL (el cliente ya lo exige); aborta si hay nulls. sync_subgroup no
--     valida la clave en el payload: un cliente que la omita fallará con 23502.
--  6. subgroups_estado_check (pre-014, más laxa) redundante con groups_estado_check.

-- ── 1. RLS: INSERT exige membresía ──────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert own subgroups" ON public.groups;
CREATE POLICY "Users can insert own subgroups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = usuario_creador
    AND EXISTS (
      SELECT 1 FROM public.plantation_users pu
      WHERE pu.plantation_id = groups.plantation_id
        AND pu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own trees" ON public.trees;

-- ── 2. Retiro de update_tree_ids (020), superseded por generate_tree_ids (029) ─

DROP FUNCTION IF EXISTS public.update_tree_ids(jsonb);

-- ── 3. search_path fijo en SECURITY DEFINER sin fijar ────────────────────────

ALTER FUNCTION public.add_admin_memberships_to_plantation() SET search_path = public;
ALTER FUNCTION public.sync_admin_memberships_on_rol_change() SET search_path = public;
ALTER FUNCTION public.sync_subgroup(p_subgroup jsonb, p_trees jsonb) SET search_path = public;
ALTER FUNCTION public.generate_tree_ids(p_plantation_id uuid, p_seed integer) SET search_path = public;

-- ── 4. Índices de FK ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS groups_plantation_id_idx ON public.groups (plantation_id);
CREATE INDEX IF NOT EXISTS trees_group_id_idx ON public.trees (group_id);

-- ── 5. groups.parcela_id NOT NULL ────────────────────────────────────────────

DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls FROM public.groups WHERE parcela_id IS NULL;
  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'groups.parcela_id: % fila(s) con parcela_id NULL, no se puede aplicar NOT NULL', v_nulls;
  END IF;
END;
$$;

ALTER TABLE public.groups ALTER COLUMN parcela_id SET NOT NULL;

-- ── 6. Retiro de la constraint legacy subgroups_estado_check ────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_estado_check'
  ) THEN
    RAISE EXCEPTION 'groups_estado_check no existe: abortando drop de subgroups_estado_check';
  END IF;
END;
$$;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS subgroups_estado_check;
