---
phase: 01-foundation-auth
plan: 02
subsystem: database
tags: [supabase, postgres, rls, sql, seed, typescript, tsx]

# Dependency graph
requires: []
provides:
  - Postgres schema for 8 tables: organizations, profiles, species, plantations, plantation_species, plantation_users, subgroups, trees
  - RLS enabled on all tables with authenticated-user read policies
  - Node.js seed script for creating 4 test users via Supabase Admin API
  - .env.example documenting required environment variables
  - Root package.json with tsx for running seed script
affects:
  - 01-03-auth (depends on profiles table and seeded users for login flow testing)
  - 01-01-setup (Expo app will consume EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY)
  - 03-sync (depends on Supabase RPC design against these tables)

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js ^2.99.0 (admin client for seed script)"
    - "tsx ^4.19.2 (TypeScript execution for Node.js seed script)"
    - "dotenv ^16.4.7 (env loading in seed script)"
  patterns:
    - "Supabase Admin API (auth.admin.createUser) for seeding — not raw SQL into auth.users"
    - "Idempotent seeding via upsert with onConflict — safe to run multiple times"
    - "RLS enabled on all tables — unauthenticated reads rejected by default"

key-files:
  created:
    - supabase/migrations/001_initial_schema.sql
    - supabase/seed.ts
    - .env.example
    - package.json (root)
  modified: []

key-decisions:
  - "Use supabase.auth.admin.createUser() in Node.js script rather than raw SQL for user seeding — aligns with Supabase recommendation and avoids auth.users direct manipulation"
  - "Seed script is idempotent: handles 'already registered' error and upserts profiles for existing users"
  - "Organization fixed UUID (00000000-0000-0000-0000-000000000001) for deterministic cross-script referencing"
  - "Root package.json created at repo root (not inside mobile/) for seed tooling isolation"

patterns-established:
  - "Pattern: Supabase migrations in supabase/migrations/ as plain SQL files applied via dashboard SQL editor"
  - "Pattern: Seed scripts run from repo root via npx tsx supabase/seed.ts"

requirements-completed: [FOUN-04, FOUN-05]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 1 Plan 02: Supabase Backend Schema + Seed Summary

**Postgres schema with 8 tables and RLS deployed via SQL migration file, plus idempotent TypeScript seed script creating 4 test users (2 admin, 2 tecnico) via Supabase Admin API**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-17T01:54:53Z
- **Completed:** 2026-03-17T01:57:33Z
- **Tasks:** 2 auto tasks + 1 checkpoint (auto-approved)
- **Files modified:** 5

## Accomplishments

- Supabase Postgres schema with all 8 required tables and RLS policies created as SQL migration file
- Idempotent TypeScript seed script using Supabase Admin API to create 4 test users with matching profiles
- Root-level package.json with tsx tooling so seed can be run without entering mobile/ directory
- .env.example template documenting all required environment variables

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase schema SQL + environment setup** - `551d00f` (chore)
2. **Task 2: Supabase user seed script** - `7b4f5ad` (feat)

**Plan metadata:** _(final docs commit below)_

## Files Created/Modified

- `supabase/migrations/001_initial_schema.sql` - Full Postgres DDL for 8 tables + RLS enable + 10 RLS policies
- `supabase/seed.ts` - Admin client seed: creates Bayka org + 4 users in auth.users + 4 profiles rows
- `.env.example` - Template with EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- `package.json` (root) - Minimal package with tsx, dotenv, @supabase/supabase-js for seed execution
- `package-lock.json` (root) - Lock file for above

## Tables Created

| Table | Purpose |
|-------|---------|
| organizations | Client organizations (Bayka) |
| profiles | User profiles extending auth.users with rol and organizacion_id |
| species | Global species catalog |
| plantations | Plantation events per organization |
| plantation_species | Species available in a plantation's UI (with visual order) |
| plantation_users | Technicians assigned to plantations |
| subgroups | Sub-units within a plantation (linea, parcela) |
| trees | Individual tree records |

## Seeded Users (emails only — passwords in .env)

| Email | Role |
|-------|------|
| admin1@bayka.org | admin |
| admin2@bayka.org | admin |
| tecnico1@bayka.org | tecnico |
| tecnico2@bayka.org | tecnico |

## RLS Policies Summary

- **profiles:** Users can read and update their own profile only
- **species:** All authenticated users can read
- **plantations:** All authenticated users can read
- **plantation_species:** All authenticated users can read
- **plantation_users:** All authenticated users can read
- **subgroups:** All authenticated users can read; creators can insert (auth.uid() = usuario_creador)
- **trees:** All authenticated users can read; creators can insert (auth.uid() = usuario_registro)
- **organizations:** RLS enabled, no public policies (service role access only from seed)

## Decisions Made

- Used `supabase.auth.admin.createUser()` rather than direct `auth.users` SQL inserts — required approach per Supabase docs (Pitfall 6 in research)
- Seed script handles existing users idempotently to allow safe re-runs
- Organization fixed UUID for deterministic seeding without UUID lookup
- Created root-level package.json to isolate seed tooling from the Expo mobile project in `mobile/`

## Deviations from Plan

**1. [Rule 3 - Blocking] Created root package.json for seed dependencies**

- **Found during:** Task 2 (Supabase user seed script)
- **Issue:** No root-level package.json existed; `npx tsx supabase/seed.ts` requires tsx and @supabase/supabase-js at root
- **Fix:** Created minimal root package.json with required dependencies, ran npm install
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx tsx supabase/seed.ts` executes (fails on placeholder credentials, not on import errors)
- **Committed in:** 7b4f5ad (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing dependency)
**Impact on plan:** Root package.json is necessary infrastructure for seed execution. No scope creep.

## User Setup Required

**Before running the seed script, fill in `.env` with real Supabase credentials:**

1. Go to Supabase Dashboard → Project Settings → API
2. Copy Project URL → `EXPO_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

**Apply schema to Supabase:**
1. Go to Supabase Dashboard → SQL Editor
2. Paste contents of `supabase/migrations/001_initial_schema.sql`
3. Run — verify 8 tables appear in Table Editor

**Run seed:**
```bash
npx tsx supabase/seed.ts
```

**Verify in Supabase Dashboard:**
- Authentication → Users: 4 users confirmed
- Table Editor → profiles: 4 rows, 2 with rol='admin', 2 with rol='tecnico'
- Table Editor → organizations: 1 row id=00000000-0000-0000-0000-000000000001, nombre='Bayka'

## Next Phase Readiness

- Schema and seed artifacts ready — Plan 01-03 (auth flow) can proceed once user applies schema and runs seed with real credentials
- .env needs real Supabase credentials before any Supabase-dependent tests can run
- Plan 01-01 (Expo app setup) runs in parallel and is independent of this plan

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: supabase/migrations/001_initial_schema.sql
- FOUND: supabase/seed.ts
- FOUND: .env.example
- FOUND: package.json (root)
- FOUND: .planning/phases/01-foundation-auth/01-02-SUMMARY.md
- FOUND commit: 551d00f (Task 1)
- FOUND commit: 7b4f5ad (Task 2)
