-- Objetos fuera del schema "public" que `supabase db dump --schema public`
-- no puede traer (viven en storage/auth), pero son parte del estado real de
-- staging/prod. Se pegan al final de supabase/baseline_schema.sql tal cual
-- (ver supabase/tests/regenerate-baseline.sh). Idempotente: reentra limpio
-- sobre un stack ya migrado.

-- ── Bucket 'tree-photos' + policies de storage.objects (migración 008) ──────
-- 008 asumía el bucket creado a mano desde el Dashboard antes de aplicarla;
-- acá se crea por SQL para que el baseline alcance por sí solo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tree-photos', 'tree-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload tree photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload tree photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Authenticated users can read tree photos" ON storage.objects;
CREATE POLICY "Authenticated users can read tree photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Authenticated users can update tree photos" ON storage.objects;
CREATE POLICY "Authenticated users can update tree photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tree-photos'
  AND auth.uid() IS NOT NULL
);

-- ── Triggers de auth.users (migración 026) ───────────────────────────────────
-- Sus funciones (handle_new_user, sync_profile_email) sí vienen en el dump:
-- viven en public. Solo faltan los triggers que las cuelgan de auth.users.
CREATE OR REPLACE TRIGGER "trg_handle_new_user"
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE TRIGGER "trg_sync_profile_email"
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_profile_email();
