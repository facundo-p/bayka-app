---
phase: quick
plan: 260408-bgv
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/seed.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Running seed.ts creates all 5 new users with correct roles in Supabase Auth"
    - "Each new user has a profile row with correct nombre, rol, and organizacion_id"
    - "Existing users are not duplicated (upsert handles re-runs)"
  artifacts:
    - path: "supabase/seed.ts"
      provides: "Updated seed script with new users"
      contains: "mili@bayka.org"
  key_links:
    - from: "supabase/seed.ts"
      to: "Supabase Auth + profiles table"
      via: "supabase.auth.admin.createUser + profiles.insert/upsert"
---

<objective>
Update the existing seed script to include 5 new Bayka team users with their correct roles and credentials.

Purpose: Populate the Supabase database with real team member accounts for testing and development.
Output: Updated supabase/seed.ts that seeds all new users on next run.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@supabase/seed.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add new team users to seed script</name>
  <files>supabase/seed.ts</files>
  <action>
Update the USERS array in supabase/seed.ts to REPLACE the existing demo users with the real team users. The existing demo users (admin1, admin2, tecnico1, tecnico2) are no longer needed.

New USERS array should contain exactly these entries:

| nombre | rol | email | password |
|--------|-----|-------|----------|
| Mili | admin | mili@bayka.org | Bayka1! |
| Mili Tec | tecnico | militec@bayka.org | Bayka1! |
| Mati | admin | mati@bayka.org | Bayka1! |
| Facu | admin | facu@bayka.org | Bayka1! |
| Facu Tec | tecnico | facutec@bayka.org | Bayka1! |

Keep the existing ORG_ID (00000000-0000-0000-0000-000000000001) and all existing seed logic (organization upsert, auth.admin.createUser with email_confirm, profile insert, "already exists" handling with upsert). Only change the USERS array contents.

Update the final console.log section to print the new credentials.
  </action>
  <verify>
    <automated>cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign && grep -c "bayka.org" supabase/seed.ts | grep -q "5" && echo "PASS: 5 users found" || echo "FAIL"</automated>
  </verify>
  <done>seed.ts contains all 5 new users with correct emails, passwords, nombres, and roles. Old demo users removed.</done>
</task>

</tasks>

<verification>
- grep for all 5 emails in seed.ts confirms presence
- No TypeScript syntax errors (npx tsc --noEmit supabase/seed.ts or manual review)
- Script structure unchanged: org upsert, user loop with createUser + profile insert
</verification>

<success_criteria>
- supabase/seed.ts has exactly 5 users matching the specification
- Each user has correct nombre, rol, email, password
- Running `npx tsx supabase/seed.ts` will create all users (manual run by user)
</success_criteria>

<output>
After completion, create `.planning/quick/260408-bgv-script-agregar-usuarios-seed-a-supabase/260408-bgv-SUMMARY.md`
</output>
