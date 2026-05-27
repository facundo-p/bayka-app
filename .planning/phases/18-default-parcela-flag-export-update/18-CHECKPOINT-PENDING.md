# Phase 18 — Visual Checkpoint (Pending User Action)

**Status:** ⏸ awaiting manual device verification
**Closes:** v1.1 milestone (SC#2 + SC#5 + SC#6 device-real validation)
**Blocking:** Phase 18 final SUMMARY + v1.1 close

This is the only remaining gate for Phase 18. Code, type-check, and tests are all green:

- `tsc --noEmit` → 0 errors
- Default jest suite → 358/371 pass (13 pre-existing failures from Phase 16, unchanged)
- Integration suite → 81/83 pass (2 pre-existing failures from Phase 16, unchanged)
- New tests added by Plan 18-02: 9 unit (ExportService) + 3 integration (exportQueries) — all green
- `grep -rni "subgrupo" mobile/src mobile/app` (excluding `.styles.`, `COMPAT:`, `PHASE-17:`) → 0 hits

## What was built (Phase 18)

1. **Plan 18-01 (commits f25f6a7 → 535cb8a):** `AUTO_PARCELA_DEFAULT` compile-time flag + `createPlantationWithDefaultParcela` helper. Creates a `Parcela 1` / `P1` automatically when a plantation is created.
2. **Plan 18-02 (commits 45d3003, 3e54010, 66a56b2):** Export CSV/Excel now emits the 9-column ROADMAP order with new "Plantación" + "Parcela" columns, LEFT JOIN to parcelas (legacy groups → empty string).

## Manual verification steps (Android device or emulator)

1. **Build:** `cd mobile && npx expo run:android --device` *(or `npx eas build -p android --profile development --local`)*.
2. **Login** as admin (user with plantation access).
3. Tap **`+`** in PlantacionesScreen header → create a new plantation with `lugar = "Test Phase 18"`, `periodo = "Otoño 2026"`.
4. ✅ The plantation appears immediately in the list with an OrangeDot (pending_sync).
5. Tap the plantation → navigates to ParcelasScreen → exactly **1 parcela visible: `Parcela 1` (`P1`)** with OrangeDot.
6. Tap `Parcela 1` → navigates to GruposScreen scoped → empty state.
7. Create a group in that parcela → register 2–3 trees with species from the catalog.
8. Back to PlantacionesScreen → tap the sync icon → trees sync.
9. As admin: finalize the plantation (AdminBottomSheet → Finalizar), generate IDs (seed e.g. 1000).
10. **Export CSV:** AdminBottomSheet → "Exportar CSV". Share sheet appears; share to Drive / email / file.
11. Open the CSV in a spreadsheet app.
12. ✅ **Verify header (exact string):**
    ```
    ID Global,ID Parcial,Zona,Plantación,Parcela,Grupo,SubID,Periodo,Especie
    ```
13. ✅ **Verify data rows:**
    - `Plantación` = `Test Phase 18`
    - `Parcela` = `Parcela 1`
    - `Grupo` = name of the group created in step 7
    - `SubID` uses Phase 15 format: `P1<GroupCode><SpeciesCode><Position>`
14. **Excel:** repeat step 10 with "Exportar Excel" → verify same 9 columns in `.xlsx`.
15. **Legacy edge case:** if any pre-existing plantation has groups without `parcelaId`, export it and verify `Parcela` cell is empty (not `null`, not `N/A`). If all plantations have parcelas (expected post-Phase 15 consolidation), this edge case is N/A.

## How to mark complete

Once verified on device, the user should reply with:

- `approved` → mark Phase 18 complete; the executor (or next agent) writes the final `18-02-SUMMARY.md`, runs `gsd-sdk` state updates, closes v1.1.
- `issues: <description>` → report findings; a follow-up plan is opened.

## Where the code lives

- `mobile/src/config/featureFlags.ts` — flag definition
- `mobile/src/services/PlantationCreationService.ts` — helper
- `mobile/src/hooks/usePlantationAdmin.ts` — single call site
- `mobile/src/queries/exportQueries.ts` — LEFT JOIN to parcelas + `parcelaNombre`/`plantacionLugar`
- `mobile/src/services/ExportService.ts` — 9-column header (CSV + Excel)

## Removal recipe (if AUTO_PARCELA_DEFAULT trial is dropped)

See `18-01-SUMMARY.md` → "Removal Recipe". The Export changes (Plan 18-02) are independent and stay regardless of the flag outcome.
