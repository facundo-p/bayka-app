-- supabase/baseline_schema.sql — snapshot completo del schema "public" al día
-- de hoy, equivalente a staging/prod luego de aplicar hasta la migración 030
-- (issue #283, re-baseline real). Reemplaza el reemplay histórico de
-- supabase/migrations/001..030 (archivadas en migrations/archive/, no
-- replayables desde cero: 013-015 son migraciones de datos puntuales).
--
-- Cómo se regenera: supabase/tests/regenerate-baseline.sh (dump del stack
-- local con este baseline + las migraciones pendientes aplicadas, curado con
-- los filtros y el agregado de supabase/tests/baseline-extras.sql). Ver
-- supabase/tests/README.md y docs/db-baseline.md.
--
-- Generado con `supabase db dump --schema public`, que ya emite
-- CREATE TABLE/FUNCTION/TRIGGER/VIEW con IF NOT EXISTS / OR REPLACE (así que
-- este archivo es idempotente tal cual). Se le quitaron dos líneas del dump
-- que no aplican fuera de un pg_restore controlado:
--   - SELECT pg_catalog.set_config('search_path', '', false);
--   - SET row_security = off;
-- Y se le agregó, al final, una sección de objetos que un dump de un solo
-- schema no puede traer (bucket de storage + sus policies, triggers sobre
-- auth.users) — ver esa sección para el detalle.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_admin_memberships_to_plantation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
  SELECT NEW.id, pr.id, 'admin'
  FROM profiles pr
  WHERE pr.rol IN ('admin', 'superadmin') AND pr.activo
  ON CONFLICT (plantation_id, user_id) DO UPDATE
    SET rol_en_plantacion = 'admin';
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_admin_memberships_to_plantation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total INTEGER;
  v_con_id INTEGER;
  v_seed INTEGER;
  v_updated INTEGER;
BEGIN
  -- Gate de rol: mismo predicado que las policies admin de 024.
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND rol IN ('admin', 'superadmin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- Serializa generaciones concurrentes: el seed por defecto lee MAX(global_id)
  -- de TODAS las trees; dos corridas en paralelo duplicarían rangos.
  PERFORM pg_advisory_xact_lock(hashtext('generate_tree_ids'));

  SELECT COUNT(*), COUNT(t.global_id)
  INTO v_total, v_con_id
  FROM trees t
  JOIN groups g ON g.id = t.group_id
  WHERE g.plantation_id = p_plantation_id;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_TREES');
  END IF;

  -- Idempotencia: cuenta como generado solo si TODOS tienen global_id. Un set
  -- parcial (sync incompleto) se regenera completo, igual que hacía mobile.
  IF v_con_id = v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_GENERATED');
  END IF;

  v_seed := COALESCE(p_seed, (SELECT COALESCE(MAX(global_id), 0) + 1 FROM trees));
  IF v_seed < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_SEED');
  END IF;

  WITH ordenados AS (
    SELECT t2.id,
           ROW_NUMBER() OVER (ORDER BY g.created_at ASC, t2.posicion ASC, g.id ASC) AS rn
    FROM trees t2
    JOIN groups g ON g.id = t2.group_id
    WHERE g.plantation_id = p_plantation_id
  )
  UPDATE trees t
  SET plantacion_id = o.rn,
      global_id = v_seed + o.rn - 1
  FROM ordenados o
  WHERE t.id = o.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', v_updated, 'seed', v_seed);
END;
$$;


ALTER FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  -- Única organización del MVP (la crea el seed); si no existe, queda null.
  org_bayka uuid := (
    select id from public.organizations
    where id = '00000000-0000-0000-0000-000000000001'
  );
begin
  -- SIEMPRE 'tecnico': el rol NUNCA se toma de raw_user_meta_data. En un signUp
  -- con la anon key esa metadata la controla el cliente, así que confiar en
  -- ella sería una escalación de privilegios (cualquiera se haría superadmin).
  -- El rol elevado lo setea la edge function admin-users con service_role
  -- después de invitar, no el alta.
  insert into public.profiles (id, nombre, rol, organizacion_id, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nombre', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    'tecnico',
    org_bayka,
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  editor_es_superadmin boolean;
begin
  -- Conexiones sin usuario (service_role / dashboard / edge function): permitidas.
  if auth.uid() is null then
    return new;
  end if;
  if new.activo is distinct from old.activo or new.email is distinct from old.email then
    raise exception 'El email y el estado de un usuario solo se cambian desde la gestión de usuarios';
  end if;
  if new.rol is distinct from old.rol then
    editor_es_superadmin := exists (
      select 1 from profiles
      where id = auth.uid() and rol = 'superadmin' and activo
    );
    if not editor_es_superadmin then
      raise exception 'Solo un superadmin puede cambiar roles';
    end if;
    if old.id = auth.uid() and old.rol = 'superadmin' and new.rol <> 'superadmin' then
      raise exception 'Un superadmin no puede degradarse a sí mismo';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_profile_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stats_plantaciones"() RETURNS TABLE("plantation_id" "uuid", "arboles" bigint, "parcelas" bigint, "usuarios" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    p.id,
    (select count(*) from trees t join groups g on g.id = t.group_id
      where g.plantation_id = p.id),
    (select count(*) from parcelas pa
      where pa.plantation_id = p.id and pa.deleted_at is null),
    (select count(*) from plantation_users pu
      where pu.plantation_id = p.id)
  from plantations p
$$;


ALTER FUNCTION "public"."stats_plantaciones"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_admin_memberships_on_rol_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.rol IN ('admin', 'superadmin') AND NEW.activo THEN
    INSERT INTO plantation_users (plantation_id, user_id, rol_en_plantacion)
    SELECT p.id, NEW.id, 'admin'
    FROM plantations p
    ON CONFLICT (plantation_id, user_id) DO UPDATE
      SET rol_en_plantacion = 'admin';
  ELSIF TG_OP = 'UPDATE'
        AND OLD.rol IN ('admin', 'superadmin')
        AND NEW.rol NOT IN ('admin', 'superadmin') THEN
    -- Degradado: pierde solo las membresías que le dio el rol global.
    DELETE FROM plantation_users
    WHERE user_id = NEW.id AND rol_en_plantacion = 'admin';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_admin_memberships_on_rol_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_profile_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM plantation_users pu
    WHERE pu.plantation_id = (p_subgroup->>'plantation_id')::UUID
      AND pu.user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'PERMISSION');
  END IF;

  IF EXISTS (
    SELECT 1 FROM groups
    WHERE parcela_id = (p_subgroup->>'parcela_id')::UUID
      AND codigo = p_subgroup->>'codigo'
      AND id <> (p_subgroup->>'id')::UUID
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CODE');
  END IF;

  INSERT INTO groups (id, plantation_id, parcela_id, nombre, codigo, tipo, estado, usuario_creador, created_at)
  VALUES (
    (p_subgroup->>'id')::UUID,
    (p_subgroup->>'plantation_id')::UUID,
    (p_subgroup->>'parcela_id')::UUID,
    p_subgroup->>'nombre',
    p_subgroup->>'codigo',
    p_subgroup->>'tipo',
    CASE WHEN p_subgroup->>'estado' IN ('activa', 'finalizada')
         THEN p_subgroup->>'estado'
         ELSE 'finalizada' END,
    (p_subgroup->>'usuario_creador')::UUID,
    (p_subgroup->>'created_at')::TIMESTAMPTZ
  )
  ON CONFLICT (id) DO UPDATE SET
    estado = EXCLUDED.estado;

  INSERT INTO trees (
    id, group_id, species_id, posicion, sub_id, foto_url,
    plantacion_id, global_id, usuario_registro, created_at,
    latitude, longitude, gps_accuracy, gps_captured_at
  )
  SELECT
    (t->>'id')::UUID,
    COALESCE((t->>'group_id')::UUID, (t->>'subgroup_id')::UUID),
    NULLIF(t->>'species_id', '')::UUID,
    (t->>'posicion')::INTEGER,
    t->>'sub_id',
    t->>'foto_url',
    (t->>'plantacion_id')::INTEGER,
    (t->>'global_id')::INTEGER,
    (t->>'usuario_registro')::UUID,
    (t->>'created_at')::TIMESTAMPTZ,
    (t->>'latitude')::DOUBLE PRECISION,
    (t->>'longitude')::DOUBLE PRECISION,
    (t->>'gps_accuracy')::DOUBLE PRECISION,
    (t->>'gps_captured_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_trees) AS t
  ON CONFLICT (id) DO UPDATE SET
    species_id = EXCLUDED.species_id,
    sub_id = EXCLUDED.sub_id,
    foto_url = COALESCE(EXCLUDED.foto_url, trees.foto_url),
    plantacion_id = COALESCE(EXCLUDED.plantacion_id, trees.plantacion_id),
    global_id = COALESCE(EXCLUDED.global_id, trees.global_id),
    latitude = COALESCE(EXCLUDED.latitude, trees.latitude),
    longitude = COALESCE(EXCLUDED.longitude, trees.longitude),
    gps_accuracy = COALESCE(EXCLUDED.gps_accuracy, trees.gps_accuracy),
    gps_captured_at = COALESCE(EXCLUDED.gps_captured_at, trees.gps_captured_at);

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'UNKNOWN');
END;
$$;


ALTER FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plantation_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "codigo" "text" NOT NULL,
    "tipo" "text" DEFAULT 'linea'::"text" NOT NULL,
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "usuario_creador" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parcela_id" "uuid" NOT NULL,
    CONSTRAINT "groups_estado_check" CHECK (("estado" = ANY (ARRAY['activa'::"text", 'finalizada'::"text"]))),
    CONSTRAINT "groups_tipo_check" CHECK (("tipo" = ANY (ARRAY['linea'::"text", 'bosquete'::"text"])))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parcelas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plantation_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "codigo" "text" NOT NULL,
    "descripcion" "text",
    "pending_sync" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "parcelas_descripcion_length" CHECK (("char_length"("descripcion") <= 10000))
);


ALTER TABLE "public"."parcelas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."parcelas"."deleted_at" IS 'Tombstone para soft-delete (D-16-19). NULL = parcela activa. NOT NULL = parcela borrada (no resucitar).';



CREATE TABLE IF NOT EXISTS "public"."plantation_species" (
    "plantation_id" "uuid" NOT NULL,
    "species_id" "uuid" NOT NULL,
    "orden_visual" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."plantation_species" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plantation_users" (
    "plantation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rol_en_plantacion" "text" DEFAULT 'tecnico'::"text" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plantation_users_rol_check" CHECK (("rol_en_plantacion" = ANY (ARRAY['admin'::"text", 'tecnico'::"text"])))
);


ALTER TABLE "public"."plantation_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plantations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizacion_id" "uuid" NOT NULL,
    "lugar" "text" NOT NULL,
    "periodo" "text" NOT NULL,
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "creado_por" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "gps_capture_frequency" integer DEFAULT 10 NOT NULL,
    "gps_capture_required" boolean DEFAULT true NOT NULL,
    "descripcion" "text",
    "fecha_inicio" "date",
    "objetivo_arboles" integer,
    "visible_in_app" boolean DEFAULT true NOT NULL,
    CONSTRAINT "plantations_estado_check" CHECK (("estado" = ANY (ARRAY['activa'::"text", 'finalizada'::"text"]))),
    CONSTRAINT "plantations_gps_capture_frequency_check" CHECK (("gps_capture_frequency" >= 1)),
    CONSTRAINT "plantations_objetivo_arboles_check" CHECK (("objetivo_arboles" >= 1))
);


ALTER TABLE "public"."plantations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "rol" "text" NOT NULL,
    "organizacion_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "activo" boolean DEFAULT true NOT NULL,
    CONSTRAINT "profiles_rol_check" CHECK (("rol" = ANY (ARRAY['admin'::"text", 'tecnico'::"text", 'superadmin'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."species" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "nombre_cientifico" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."species" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."subgroups" WITH ("security_invoker"='true') AS
 SELECT "id",
    "plantation_id",
    "parcela_id",
    "nombre",
    "codigo",
    "tipo",
    "estado",
    "usuario_creador",
    "created_at"
   FROM "public"."groups";


ALTER VIEW "public"."subgroups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "species_id" "uuid",
    "posicion" integer NOT NULL,
    "sub_id" "text" NOT NULL,
    "foto_url" "text",
    "plantacion_id" integer,
    "global_id" integer,
    "usuario_registro" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subgroup_id" "uuid" GENERATED ALWAYS AS ("group_id") STORED,
    "latitude" double precision,
    "longitude" double precision,
    "gps_accuracy" double precision,
    "gps_captured_at" timestamp with time zone
);


ALTER TABLE "public"."trees" OWNER TO "postgres";


ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parcelas"
    ADD CONSTRAINT "parcelas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parcelas"
    ADD CONSTRAINT "parcelas_plantation_codigo_unique" UNIQUE ("plantation_id", "codigo");



ALTER TABLE ONLY "public"."parcelas"
    ADD CONSTRAINT "parcelas_plantation_nombre_unique" UNIQUE ("plantation_id", "nombre");



ALTER TABLE ONLY "public"."plantation_species"
    ADD CONSTRAINT "plantation_species_pkey" PRIMARY KEY ("plantation_id", "species_id");



ALTER TABLE ONLY "public"."plantation_users"
    ADD CONSTRAINT "plantation_users_pkey" PRIMARY KEY ("plantation_id", "user_id");



ALTER TABLE ONLY "public"."plantations"
    ADD CONSTRAINT "plantations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."species"
    ADD CONSTRAINT "species_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."species"
    ADD CONSTRAINT "species_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "subgroups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trees"
    ADD CONSTRAINT "trees_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "groups_parcela_codigo_unique" ON "public"."groups" USING "btree" ("parcela_id", "codigo");



CREATE UNIQUE INDEX "groups_parcela_nombre_unique" ON "public"."groups" USING "btree" ("parcela_id", "nombre");



CREATE INDEX "groups_plantation_id_idx" ON "public"."groups" USING "btree" ("plantation_id");



CREATE UNIQUE INDEX "parcelas_plantation_code_unique" ON "public"."parcelas" USING "btree" ("plantation_id", "codigo") WHERE ("deleted_at" IS NULL);



COMMENT ON INDEX "public"."parcelas_plantation_code_unique" IS 'Partial unique: tombstoneadas (deleted_at NOT NULL) excluidas. D-16-19.';



CREATE UNIQUE INDEX "parcelas_plantation_name_unique" ON "public"."parcelas" USING "btree" ("plantation_id", "nombre") WHERE ("deleted_at" IS NULL);



COMMENT ON INDEX "public"."parcelas_plantation_name_unique" IS 'Partial unique: tombstoneadas (deleted_at NOT NULL) excluidas. D-16-19.';



CREATE INDEX "trees_group_id_idx" ON "public"."trees" USING "btree" ("group_id");



CREATE OR REPLACE TRIGGER "trg_add_admin_memberships" AFTER INSERT ON "public"."plantations" FOR EACH ROW EXECUTE FUNCTION "public"."add_admin_memberships_to_plantation"();



CREATE OR REPLACE TRIGGER "trg_protect_profile_fields" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_fields"();



CREATE OR REPLACE TRIGGER "trg_sync_admin_memberships" AFTER INSERT OR UPDATE OF "rol" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_admin_memberships_on_rol_change"();



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_parcela_id_fkey" FOREIGN KEY ("parcela_id") REFERENCES "public"."parcelas"("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_plantation_id_fkey" FOREIGN KEY ("plantation_id") REFERENCES "public"."plantations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parcelas"
    ADD CONSTRAINT "parcelas_plantation_id_fkey" FOREIGN KEY ("plantation_id") REFERENCES "public"."plantations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plantation_species"
    ADD CONSTRAINT "plantation_species_plantation_id_fkey" FOREIGN KEY ("plantation_id") REFERENCES "public"."plantations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plantation_species"
    ADD CONSTRAINT "plantation_species_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id");



ALTER TABLE ONLY "public"."plantation_users"
    ADD CONSTRAINT "plantation_users_plantation_id_fkey" FOREIGN KEY ("plantation_id") REFERENCES "public"."plantations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plantation_users"
    ADD CONSTRAINT "plantation_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."plantation_users"
    ADD CONSTRAINT "plantation_users_user_id_profiles_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."plantations"
    ADD CONSTRAINT "plantations_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."plantations"
    ADD CONSTRAINT "plantations_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organizacion_id_fkey" FOREIGN KEY ("organizacion_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "subgroups_usuario_creador_fkey" FOREIGN KEY ("usuario_creador") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."trees"
    ADD CONSTRAINT "trees_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trees"
    ADD CONSTRAINT "trees_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "public"."species"("id");



ALTER TABLE ONLY "public"."trees"
    ADD CONSTRAINT "trees_usuario_registro_fkey" FOREIGN KEY ("usuario_registro") REFERENCES "auth"."users"("id");



CREATE POLICY "Admin can delete plantation_species" ON "public"."plantation_species" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can delete plantation_users" ON "public"."plantation_users" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can insert plantation_species" ON "public"."plantation_species" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can insert plantation_users" ON "public"."plantation_users" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can insert plantations" ON "public"."plantations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can insert species" ON "public"."species" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can update plantation_species" ON "public"."plantation_species" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can update plantations" ON "public"."plantations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Admin can update species" ON "public"."species" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."rol" = ANY (ARRAY['admin'::"text", 'superadmin'::"text"]))))));



CREATE POLICY "Authenticated can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read organizations" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read parcelas" ON "public"."parcelas" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read plantation_species" ON "public"."plantation_species" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read plantation_users" ON "public"."plantation_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read plantations" ON "public"."plantations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read species" ON "public"."species" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read subgroups" ON "public"."groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read trees" ON "public"."trees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Plantation members can delete parcelas" ON "public"."parcelas" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."plantation_users" "pu"
  WHERE (("pu"."plantation_id" = "parcelas"."plantation_id") AND ("pu"."user_id" = "auth"."uid"())))));



CREATE POLICY "Plantation members can insert parcelas" ON "public"."parcelas" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."plantation_users" "pu"
  WHERE (("pu"."plantation_id" = "parcelas"."plantation_id") AND ("pu"."user_id" = "auth"."uid"())))));



CREATE POLICY "Plantation members can insert trees" ON "public"."trees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."groups" "sg"
     JOIN "public"."plantation_users" "pu" ON (("pu"."plantation_id" = "sg"."plantation_id")))
  WHERE (("sg"."id" = "trees"."group_id") AND ("pu"."user_id" = "auth"."uid"())))));



CREATE POLICY "Plantation members can update parcelas" ON "public"."parcelas" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."plantation_users" "pu"
  WHERE (("pu"."plantation_id" = "parcelas"."plantation_id") AND ("pu"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."plantation_users" "pu"
  WHERE (("pu"."plantation_id" = "parcelas"."plantation_id") AND ("pu"."user_id" = "auth"."uid"())))));



CREATE POLICY "Plantation members can update trees" ON "public"."trees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."groups" "sg"
     JOIN "public"."plantation_users" "pu" ON (("pu"."plantation_id" = "sg"."plantation_id")))
  WHERE (("sg"."id" = "trees"."group_id") AND ("pu"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."groups" "sg"
     JOIN "public"."plantation_users" "pu" ON (("pu"."plantation_id" = "sg"."plantation_id")))
  WHERE (("sg"."id" = "trees"."group_id") AND ("pu"."user_id" = "auth"."uid"())))));



CREATE POLICY "Superadmin can update profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "editor"
  WHERE (("editor"."id" = "auth"."uid"()) AND ("editor"."rol" = 'superadmin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "editor"
  WHERE (("editor"."id" = "auth"."uid"()) AND ("editor"."rol" = 'superadmin'::"text")))));



CREATE POLICY "Users can insert own subgroups" ON "public"."groups" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "usuario_creador") AND (EXISTS ( SELECT 1
   FROM "public"."plantation_users" "pu"
  WHERE (("pu"."plantation_id" = "groups"."plantation_id") AND ("pu"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parcelas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plantation_species" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plantation_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plantations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."species" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trees" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_admin_memberships_to_plantation"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_admin_memberships_to_plantation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_admin_memberships_to_plantation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_tree_ids"("p_plantation_id" "uuid", "p_seed" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_profile_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_profile_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_profile_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."stats_plantaciones"() TO "anon";
GRANT ALL ON FUNCTION "public"."stats_plantaciones"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."stats_plantaciones"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_admin_memberships_on_rol_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_admin_memberships_on_rol_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_admin_memberships_on_rol_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_subgroup"("p_subgroup" "jsonb", "p_trees" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."parcelas" TO "anon";
GRANT ALL ON TABLE "public"."parcelas" TO "authenticated";
GRANT ALL ON TABLE "public"."parcelas" TO "service_role";



GRANT ALL ON TABLE "public"."plantation_species" TO "anon";
GRANT ALL ON TABLE "public"."plantation_species" TO "authenticated";
GRANT ALL ON TABLE "public"."plantation_species" TO "service_role";



GRANT ALL ON TABLE "public"."plantation_users" TO "anon";
GRANT ALL ON TABLE "public"."plantation_users" TO "authenticated";
GRANT ALL ON TABLE "public"."plantation_users" TO "service_role";



GRANT ALL ON TABLE "public"."plantations" TO "anon";
GRANT ALL ON TABLE "public"."plantations" TO "authenticated";
GRANT ALL ON TABLE "public"."plantations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."species" TO "anon";
GRANT ALL ON TABLE "public"."species" TO "authenticated";
GRANT ALL ON TABLE "public"."species" TO "service_role";



GRANT ALL ON TABLE "public"."subgroups" TO "anon";
GRANT ALL ON TABLE "public"."subgroups" TO "authenticated";
GRANT ALL ON TABLE "public"."subgroups" TO "service_role";



GRANT ALL ON TABLE "public"."trees" TO "anon";
GRANT ALL ON TABLE "public"."trees" TO "authenticated";
GRANT ALL ON TABLE "public"."trees" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







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
