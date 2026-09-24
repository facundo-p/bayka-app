-- Un perfil inactivo deja de ver su organización y de editarse a sí mismo (#532).
--
-- #506 y #508 sacaron al inactivo de los gates por rol y por membresía, pero
-- quedaban dos caminos que no miraban `profiles.activo`:
--
--   * `current_organizacion_id()` devolvía la organización igual, y con eso el
--     inactivo seguía leyendo nombres, emails y roles de toda su organización
--     (`Members can read org profiles`) y la fila de `organizations`.
--   * `Users can update own profile` lo dejaba cambiarse el `nombre`. El trigger
--     `protect_profile_fields` ya bloquea `activo`, `email`, `eliminado_en` y `rol`.
--
-- Alcanza con un access token emitido antes del ban, o con una baja hecha por SQL.
--
-- `Users can read own profile` NO se toca: es la policy por la que la web
-- (`useAuth` → `sin-acceso`) y la app (`fetchAndCacheRole` → cuenta desactivada)
-- se enteran de que la cuenta está dada de baja. Si dejara de devolver la fila,
-- el móvil caería al rol cacheado y el usuario seguiría adentro.

-- ── A. El helper de organización exige perfil activo ─────────────────────────

-- Devuelve NULL para un perfil inactivo, así las policies que comparan contra
-- él no matchean ninguna fila. Los demás usos del helper van siempre en AND con
-- `is_admin()` o `is_superadmin()`, que ya exigen activo, así que no cambian.
-- Sí cambia `estado_remoto_plantaciones` (039): para un inactivo, una plantación
-- borrada pasa a informarse como `sin_acceso` en vez de `eliminada`. El móvil
-- trata a las dos como "pull sin datos", así que solo cambia el texto del aviso.
CREATE OR REPLACE FUNCTION "public"."current_organizacion_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT organizacion_id FROM profiles WHERE id = auth.uid() AND activo;
$$;

-- ── B. Editar el propio perfil exige perfil activo ───────────────────────────

-- La versión de la baseline no declaraba `TO` (aplicaba también a `anon`, que
-- nunca tiene `auth.uid()`) ni `WITH CHECK`, que Postgres suplía con el `USING`.
-- Ahora los dos son explícitos, como el resto de las policies de escritura.
DROP POLICY IF EXISTS "Users can update own profile" ON "public"."profiles";
CREATE POLICY "Users can update own profile" ON "public"."profiles"
  FOR UPDATE TO "authenticated"
  USING (auth.uid() = id AND activo)
  WITH CHECK (auth.uid() = id AND activo);
