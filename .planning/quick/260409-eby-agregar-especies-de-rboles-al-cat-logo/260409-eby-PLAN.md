---
phase: quick
plan: 260409-eby
type: execute
wave: 1
depends_on: []
files_modified:
  - mobile/assets/species.json
  - supabase/migrations/007_add_species_batch2.sql
autonomous: true
must_haves:
  truths:
    - "8 new species (Cambota, Canela palta, Huaica, Inga, Loro blanco, Palmito, Palo polvora, Siete capotes) exist in local catalog"
    - "8 new species exist in Supabase after running migration"
    - "Existing 33 species remain unchanged"
  artifacts:
    - path: "mobile/assets/species.json"
      provides: "41-species local catalog"
      contains: "CBT"
    - path: "supabase/migrations/007_add_species_batch2.sql"
      provides: "Supabase migration for 8 new species"
      contains: "INSERT INTO species"
  key_links:
    - from: "mobile/assets/species.json"
      to: "mobile/src/database/seeds/seedSpecies.ts"
      via: "JSON import"
      pattern: "speciesData"
---

<objective>
Add 8 new tree species to the catalog in both the local SQLite database (via species.json) and Supabase (via SQL migration).

New species with assigned UUIDs (continuing from a0000000-0000-0000-0000-000000000033):
- a0000000-0000-0000-0000-000000000034: CBT - Cambota
- a0000000-0000-0000-0000-000000000035: CPT - Canela Palta
- a0000000-0000-0000-0000-000000000036: HUA - Huaica
- a0000000-0000-0000-0000-000000000037: ING - Inga
- a0000000-0000-0000-0000-000000000038: LBA - Loro Blanco
- a0000000-0000-0000-0000-000000000039: PMI - Palmito (PAL already used by Palo Rosa)
- a0000000-0000-0000-0000-000000000040: PPO - Palo Polvora
- a0000000-0000-0000-0000-000000000041: SCA - Siete Capotes

Purpose: Expand the available species catalog for field registration.
Output: Updated species.json + new Supabase migration.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@mobile/assets/species.json
@supabase/migrations/005_update_species_catalog.sql (pattern reference for species migration)
@mobile/src/database/seeds/seedSpecies.ts (reads species.json — no changes needed, handles upsert automatically)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add 8 species to local catalog and Supabase migration</name>
  <files>mobile/assets/species.json, supabase/migrations/007_add_species_batch2.sql</files>
  <action>
1. Edit `mobile/assets/species.json`: append 8 new entries after the last entry (ZOI, id ...033), maintaining alphabetical order within the new batch is NOT required — just append at end. Keep the same JSON format: `{ "id": "...", "codigo": "...", "nombre": "...", "nombre_cientifico": null }`.

   New entries:
   - { "id": "a0000000-0000-0000-0000-000000000034", "codigo": "CBT", "nombre": "Cambota", "nombre_cientifico": null }
   - { "id": "a0000000-0000-0000-0000-000000000035", "codigo": "CPT", "nombre": "Canela Palta", "nombre_cientifico": null }
   - { "id": "a0000000-0000-0000-0000-000000000036", "codigo": "HUA", "nombre": "Huaica", "nombre_cientifico": null }
   - { "id": "a0000000-0000-0000-0000-000000000037", "codigo": "ING", "nombre": "Ingá", "nombre_cientifico": null }
   - { "id": "a0000000-0000-0000-0000-000000000038", "codigo": "LBA", "nombre": "Loro Blanco", "nombre_cientifico": null }
   - { "id": "a0000000-0000-0000-0000-000000000039", "codigo": "PMI", "nombre": "Palmito", "nombre_cientifico": null }
   - { "id": "a0000000-0000-0000-0000-000000000040", "codigo": "PPO", "nombre": "Palo Pólvora", "nombre_cientifico": null }
   - { "id": "a0000000-0000-0000-0000-000000000041", "codigo": "SCA", "nombre": "Siete Capotes", "nombre_cientifico": null }

   Note: Use PMI for Palmito (not PAL — PAL is already used by Palo Rosa, id ...005).

2. Create `supabase/migrations/007_add_species_batch2.sql`: a simple INSERT statement for the same 8 species. Follow the pattern from 005_update_species_catalog.sql. Use a single INSERT with multiple VALUES rows. No transaction wrapper needed for a simple insert.

   ```sql
   -- Add 8 new tree species to the catalog
   INSERT INTO species (id, codigo, nombre, nombre_cientifico) VALUES
     ('a0000000-0000-0000-0000-000000000034', 'CBT', 'Cambota', NULL),
     ('a0000000-0000-0000-0000-000000000035', 'CPT', 'Canela Palta', NULL),
     ('a0000000-0000-0000-0000-000000000036', 'HUA', 'Huaica', NULL),
     ('a0000000-0000-0000-0000-000000000037', 'ING', 'Ingá', NULL),
     ('a0000000-0000-0000-0000-000000000038', 'LBA', 'Loro Blanco', NULL),
     ('a0000000-0000-0000-0000-000000000039', 'PMI', 'Palmito', NULL),
     ('a0000000-0000-0000-0000-000000000040', 'PPO', 'Palo Pólvora', NULL),
     ('a0000000-0000-0000-0000-000000000041', 'SCA', 'Siete Capotes', NULL);
   ```

No changes needed to seedSpecies.ts — it reads species.json dynamically and handles upsert/sync automatically.
  </action>
  <verify>
    <automated>cd /Users/facu/Desarrollos/Trabajos/BaykaApp/bayka-app-redesign && node -e "const s = require('./mobile/assets/species.json'); console.log('Total species:', s.length); const codes = s.map(x=>x.codigo); const newCodes = ['CBT','CPT','HUA','ING','LBA','PMI','PPO','SCA']; const missing = newCodes.filter(c => !codes.includes(c)); console.log('Missing codes:', missing.length ? missing.join(',') : 'NONE'); const dups = codes.filter((c,i) => codes.indexOf(c) !== i); console.log('Duplicate codes:', dups.length ? dups.join(',') : 'NONE'); console.log(s.length === 41 ? 'PASS' : 'FAIL: expected 41');"</automated>
  </verify>
  <done>species.json has 41 entries with no duplicate codes. Supabase migration file 007 exists with INSERT for 8 new species.</done>
</task>

</tasks>

<verification>
- species.json has exactly 41 entries (33 existing + 8 new)
- No duplicate codigo values across all 41 species
- All 8 new UUIDs follow the sequential pattern (a0000000-...-000000000034 through 041)
- Supabase migration file exists and contains valid SQL INSERT
- seedSpecies.ts requires no changes (it reads species.json dynamically)
</verification>

<success_criteria>
- 41 species in species.json with unique codigos and IDs
- Supabase migration 007 ready to apply
- Local app will pick up new species on next seedSpeciesIfNeeded() call
</success_criteria>

<output>
After completion, create `.planning/quick/260409-eby-agregar-especies-de-rboles-al-cat-logo/260409-eby-SUMMARY.md`
</output>
