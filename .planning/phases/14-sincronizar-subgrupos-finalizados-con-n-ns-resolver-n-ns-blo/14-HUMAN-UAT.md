---
status: partial
phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
source: [14-VERIFICATION.md]
started: 2026-04-14T19:16:00Z
updated: 2026-04-14T19:16:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. PlantationCard N/N stat display
expected: Yellow help-circle icon + count appears only for plantations with unresolved N/N trees
result: [pending]

### 2. AdminBottomSheet N/N finalization gate
expected: Finalizar button disabled, helper text shows "X arboles N/N sin resolver en Y subgrupos"
result: [pending]

### 3. NNResolutionScreen conflict banner
expected: Red-bordered banner with "Conflicto detectado" heading, server species name, and two action buttons
result: [pending]

### 4. Accept/keep conflict resolution actions
expected: Accept server changes species to server's choice; keep local dismisses banner and preserves local species
result: [pending]

### 5. SubGroupCard N/N badge colors
expected: Badge with secondaryYellowLight background, secondaryYellowDark text, secondaryYellowMedium border
result: [pending]

### 6. End-to-end N/N sync
expected: Subgroups with unresolved N/N trees upload successfully, trees arrive at server with especieId=null
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
