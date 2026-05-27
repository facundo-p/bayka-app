# Phase 17 — Plan Check Report

**Reviewed:** 2026-05-27
**Plans reviewed:** 17-01, 17-02, 17-03 (+ 17-CONTEXT)
**Reviewer:** plan-checker (goal-backward analysis)

---

## Verdict

**PASS-WITH-NOTES**

Plans cover the 10 ROADMAP success criteria and all PUI/GUI/GRPN-08 requirements. Decisions D-17-01..22 are honored. The architecture (single `ParcelaFormModal`, reused `ParcelaRow`, expandable card via `LayoutAnimation`) is coherent and respects CLAUDE.md §§3/8/9. Three notes about (a) requirements-vs-context drift on `descripcion` preview, (b) a hook-call performance gap acknowledged but not bounded, and (c) test-label residuals are documented as acceptable but worth a sanity check at audit time. None of these block execution.

---

## Coverage Matrix

| # | ROADMAP Success Criterion | Plan / Task | Decision | Status |
|---|---------------------------|-------------|----------|--------|
| 1 | Tap `PlantationCard` → `ParcelasScreen`; tap `ParcelaRow` → `GruposScreen` scoped | 17-01 Task 1.6 (card→parcelas) + 17-01 Task 1.4 (row→grupos via `?parcelaId=`) + 17-03 Task 3.3 (closes scope) | D-17-09, D-17-12 | COVERED |
| 2 | `ParcelaRow` muestra nombre/código/grupos/árboles/OrangeDot | 17-01 Task 1.1 | D-17-05 | COVERED (with note — see Finding #1) |
| 3 | Header `+` crear; long-press editar | 17-01 Tasks 1.3, 1.4 | D-17-06, D-17-08 | COVERED |
| 4 | Empty state con CTA "Crear primera parcela" | 17-01 Task 1.4 | D-17-07 | COVERED |
| 5 | `PlantationCard` fila "Parcelas: N" + chevron + expand inline | 17-02 Tasks 2.2, 2.3, 2.4 | D-17-10, D-17-14 | COVERED |
| 6 | Inline parcela → grupos scoped; long-press → modal edit | 17-02 Task 2.3 | D-17-12 | COVERED |
| 7 | `GruposScreen` recibe `parcelaId`, filtra, auto-asigna en create | 17-03 Tasks 3.2, 3.3, 3.4 | D-17-15..17 | COVERED |
| 8 | Eliminar botón inferior; header `+` | 17-03 Task 3.3 (eliminar fabContainer + headerRight) | D-17-18 | COVERED |
| 9 | Cero strings visibles "Subgrupo"/"subgrupo" | 17-03 Tasks 3.1, 3.6–3.11 | D-17-20, D-17-21 | COVERED |
| 10 | Visual checkpoint final | 17-03 Task 3.12 (16-step flow) | D-17-22 | COVERED |

**Requirements coverage (PUI/GUI):** PUI-01..06 → 17-01; PUI-07..10 → 17-02; GUI-01..04 → 17-03; GRPN-08 → 17-03; TEST-PARC-04 → 17-03 (visual checkpoint). TEST-PARC-05 listed in ROADMAP Phase 17 requirements line but explicitly deferred to Phase 18 by both CONTEXT and ROADMAP Phase 18 — not a gap.

---

## Findings

### 1. [WARN] PUI-01 vs D-17-05 contradiction — REQUIREMENTS.md says `descripcion` preview shown, CONTEXT says hidden

`REQUIREMENTS.md` line 269 PUI-01 explicitly requires: "Si la parcela tiene `descripcion`, se muestra una preview truncada (~80 chars) debajo del nombre". `17-CONTEXT` D-17-05 (decisión usuario 2026-05-27) explicitly overrides this: descripcion oculta siempre. Plan 17-01 Task 1.1 correctly follows D-17-05.

**This is a documentation drift, not a plan defect.** The CONTEXT decision is the locked source. However, REQUIREMENTS.md still carries the older spec verbatim, and the ROADMAP Plans list line 404 still says "lista con preview de `descripcion` truncada". The plan author honored the user decision correctly.

**Suggested fix:** During execution, add a one-line note to the final commit message of 17-01 ("D-17-05 supersedes PUI-01 preview clause"), and update REQUIREMENTS.md PUI-01 in a doc-only follow-up (or in 17-03 Task 3.1 baseline commit) so the requirements line matches reality. No code action needed.

### 2. [WARN] `useParcelas` called on every `PlantationCard` regardless of expanded state — performance gate is qualitative

17-02 Task 2.4 chooses to call `useParcelas(plantacionId)` unconditionally inside `ExpandablePlantationCard` to keep "Parcelas: N" populated for the collapsed state. The risk is acknowledged (Risks #3) and a fallback (`useParcelasCount` separate hook) is proposed if benchmarks degrade. But the success criterion is "FPS no degrada perceptiblemente" — qualitative.

**Why it doesn't block:** Current prod max is ~10 plantaciones per technician (per CONTEXT performance discussion in 17-02 Risks); per-card cost is one indexed query against a small dataset; FPS gate is reasonable for v1.1.

**Suggested fix (NIT):** Add a numeric gate to 17-02 Verification Plan step 4 — "if scroll on 10 plantaciones drops below 50 FPS, pivot to `useParcelasCount` before merge". Right now the trigger is implicit.

### 3. [NIT] Single-expansion in `PlantationCard` is a planner deviation from CONTEXT but well-justified

CONTEXT D-17-13 says expansion state is "local al card" (implying any card can be expanded independently). 17-02 Task 2.3 narrows this to single-expansion (`expandedPlantationId: string | null`) under Claude's Discretion (CONTEXT line 67 allows it). This is a UX tightening, not a contradiction.

**Why it doesn't block:** Single-expansion is a common mobile pattern, helps the perf concern in Finding #2, and is documented in the Risks section. Just confirm with user at first visual checkpoint that switching between cards feels intentional.

### 4. [NIT] `validateGroupUniqueness` per-parcela hardening (Task 3.5) is correctly scoped

Task 3.5 changes `validateGroupUniqueness(plantacionId, ...)` → `(plantacionId, parcelaId, ...)` to match the per-parcela schema constraint installed in Phase 15. The fallback (when `parcelaId` is null) preserves the old per-plantacion check with a warning. This is bounded (one repo file, ≤20 LOC) and necessary to honor GUI-04 semantics on uniqueness — without it, two grupos with the same code in different parcelas of the same plantation would erroneously fail TS validation even though SQL allows it.

**Verdict:** correctly scoped, does not expand 17-03 beyond reason.

### 5. [WARN] Route rename `nuevo-subgrupo.tsx` → `nuevo-grupo.tsx` could break deep links from earlier APKs

Phase 16 left the route slug `nuevo-subgrupo` intact for back-compat. 17-03 Task 3.9 `git mv`s it to `nuevo-grupo`. Any in-flight Android APK with a pending `router.push('.../nuevo-subgrupo')` enqueued via deep link or OAuth callback will hit a 404.

**Why it doesn't block:** This is an internal route, not a public deep link, and the app is Android-only with no app-store rollout cadence that would have stale clients holding a stored URL. The visual checkpoint (Task 3.12) will exercise the new route; if a regression appears in a corner case, the rollback is trivial (`git mv` reversed). However, the plan does not document a rollback procedure or a transient alias route.

**Suggested fix:** Add a one-liner to 17-03 Risks: "Rollback: `git mv nuevo-grupo.tsx nuevo-subgrupo.tsx` + revert `_layout.tsx` name attr. No DB state to undo." Optional but cheap.

### 6. [NIT] Test labels (`describe('Subgrupo...')`) excluded per D-17-21 — verify at audit

Task 3.11 explicitly accepts `describe`/`it` label residuals as "comentarios" out of scope per D-17-21. This is consistent with the decision. The audit grep (Verification Plan step 3) uses `grep -v "^.*//.*[Ss]ubgrupo"` which catches `//` comments but does NOT exclude `describe(`/`it(` lines — those would still appear in the post-rename diff and need manual classification at audit time.

**Suggested fix:** During Task 3.11, when classifying residuales, explicitly enumerate test label matches as a category and confirm each is a label and not a `getByText` assertion. The current plan implies this but doesn't enforce it. Low risk because Task 3.10 already touches assertion strings.

### 7. [NIT] CLAUDE.md §9 compliance — clean

Scanned all tasks: no `db.*` calls in screens or components. 17-01 routes data through `useParcelas`/`useNewParcela`. 17-02 routes through `useParcelas` only. 17-03 extends `usePlantationDetail` (hook layer) and `GroupRepository` (repo layer) — no SQL in screens or components. **No violation.**

### 8. [NIT] CLAUDE.md §8 compliance — clean, with bonus

17-02 Task 2.1 explicitly extracts existing inline styles in `PlantationCard.tsx` to a new `.styles.ts` BEFORE adding expansion logic. This is exactly the right ordering and honors the memory `feedback_no_inline_styles.md`. Theme tokens are referenced consistently. **No violation; bonus point for ordering.**

### 9. [NIT] Atomic tasks — within bounds

All tasks are under ~50 LOC of expected diff per the file lists and "What" descriptions. Task 3.3 (refactor `PlantationDetailScreen`) is the largest; it touches one file with ~4 distinct edits (params, defensive nav, title, header right, fab removal) — borderline but defensible because it's a coordinated refactor of one screen and each edit is independently small. Verification is present on every task.

### 10. [NIT] Dependencies declared correctly

17-01: `depends_on: Phase 16`. 17-02: `depends_on: 17-01`. 17-03: `depends_on: 17-01, 17-02`. No cycles, no forward references. **Clean.**

### 11. [NIT] Branch invariant respected

All three plans operate on `gsd/v1.1-phase-15-context` (17-01 Pre-conditions explicit). No task switches branches. **Clean.**

### 12. [NIT] Single-component invariants honored

- D-17-01 (one `ParcelaFormModal` for create+edit): 17-01 Task 1.3 confirms `mode: 'create' | 'edit'` prop, single file. **Honored.**
- D-17-10 (`ParcelaRow` reused inline + standalone): 17-01 Task 1.1 confirms `variant?: 'standalone' | 'inline'` on same component; 17-02 Task 2.2 consumes it. **Honored.**
- D-17-05 (no descripcion in row): 17-01 Task 1.1 explicit "**NO** muestra `descripcion`". **Honored.**
- D-17-06 (long-press → edit, no 3-dot menu): 17-01 Tasks 1.1, 1.4 — only `onPress`/`onLongPress` in `Pressable`. **Honored.**

### 13. [NIT] Visual checkpoint depth

17-03 Task 3.12 is a 16-step flow covering: login, card chevron expand, animation, inline row tap, scoped grupos screen, header `+`, fab absence, group creation, back nav, body-tap-to-parcelas, modal create with counter, warning color ≥9000, duplicate code inline error, long-press edit, delete-with-children error, empty state CTA, sync modal text audit. **Comprehensive, matches D-17-22.**

---

## Recommendations

1. **Reconcile PUI-01 wording with D-17-05** in REQUIREMENTS.md (doc-only, can ride along in 17-03 Task 3.1 baseline commit or a separate doc PR). This is the only real artifact-of-record contradiction.
2. **Quantify the FPS gate** in 17-02 Verification Plan (e.g., "≥50 FPS on 10-plantation scroll"). Right now the threshold is qualitative.
3. **Add a rollback one-liner** for the `nuevo-subgrupo` → `nuevo-grupo` route rename in 17-03 Risks.
4. **In Task 3.11 audit**, explicitly enumerate `describe`/`it` label residuals as a classified bucket before declaring "done".

None of the above gate execution. Plans can proceed to `/gsd-execute-phase 17` after the planner optionally folds in recommendations 2–4 (≤10 minutes of edits).

---

## Strengths

- **Decision compliance is near-exhaustive.** Each of D-17-01..22 maps to a concrete task with rationale cited inline. The author cross-references decision IDs in the Why blocks consistently.
- **Pre/post grep audit pattern (Tasks 3.1 + 3.11)** is the right way to prove exhaustive rename — baseline captured before changes, residuals classified after.
- **`.styles.ts` extraction (17-02 Task 2.1) happens BEFORE expansion logic is added** — correct ordering per memory `feedback_no_inline_styles.md`, and prevents the file from growing past the 250-line threshold during the same commit.
- **`ExpandablePlantationCard` wrapper (17-02 Task 2.4)** resolves the hook-conditional-call problem cleanly, with a documented fallback path if perf degrades.
- **Visual checkpoint flow (Task 3.12) is 16 numbered steps** and exercises every D-17 decision plus the rename audit at the UI surface.
- **Single-component reuse honored across the phase**: one `ParcelaFormModal`, one `ParcelaRow`, one `ExpandablePlantationCard` — zero parallel implementations between admin/tecnico per CLAUDE.md §8.
