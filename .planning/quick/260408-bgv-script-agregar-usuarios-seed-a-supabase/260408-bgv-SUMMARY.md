---
phase: quick
plan: 260408-bgv
subsystem: supabase/seed
tags: [seed, users, auth, supabase]
dependency_graph:
  requires: []
  provides: [seeded-team-users]
  affects: [supabase-auth, profiles-table]
tech_stack:
  added: []
  patterns: [supabase-admin-createUser, upsert-on-conflict]
key_files:
  modified:
    - supabase/seed.ts
decisions:
  - "Replaced 4 generic demo users with 5 real Bayka team members keeping ORG_ID and seed logic unchanged"
metrics:
  duration: "2 min"
  completed: "2026-04-08"
  tasks: 1
  files: 1
---

# Quick Task 260408-bgv: Script — Agregar Usuarios Seed a Supabase Summary

**One-liner:** Replaced demo placeholder users with 5 real Bayka team accounts (Mili, Mili Tec, Mati, Facu, Facu Tec) using unified password Bayka1!

## What Was Done

Updated `supabase/seed.ts` USERS array to replace 4 generic demo accounts with 5 real Bayka team members:

| nombre | rol | email | password |
|--------|-----|-------|----------|
| Mili | admin | mili@bayka.org | Bayka1! |
| Mili Tec | tecnico | militec@bayka.org | Bayka1! |
| Mati | admin | mati@bayka.org | Bayka1! |
| Facu | admin | facu@bayka.org | Bayka1! |
| Facu Tec | tecnico | facutec@bayka.org | Bayka1! |

All existing seed logic was preserved: organization upsert (ORG_ID `00000000-0000-0000-0000-000000000001`), `supabase.auth.admin.createUser` with `email_confirm: true`, profile insert, and upsert-on-conflict for re-run safety.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add new team users to seed script | c10ad76 | supabase/seed.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- All 5 `bayka.org` emails present in seed.ts USERS array (verified via grep)
- No TypeScript syntax changes; only USERS array data updated
- Script structure unchanged: org upsert → user loop → profile insert with upsert fallback

## Known Stubs

None.

## Self-Check: PASSED

- `supabase/seed.ts` modified and committed at c10ad76
- All 5 users confirmed present with correct emails, names, roles, and passwords
