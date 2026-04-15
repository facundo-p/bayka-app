---
status: partial
phase: 14-sincronizar-subgrupos-finalizados-con-n-ns-resolver-n-ns-blo
source: [14-VERIFICATION.md]
started: 2026-04-14T19:16:00Z
updated: 2026-04-14T20:45:00Z
---

## Current Test

[awaiting second device for conflict tests]

## Tests

### 1. PlantationCard N/N stat display
expected: Yellow help-circle icon + count appears only for plantations with unresolved N/N trees
result: pass

### 2. AdminBottomSheet N/N finalization gate
expected: Finalizar button disabled, helper text shows "X arboles N/N sin resolver en Y subgrupos"
result: pass

### 3. NNResolutionScreen conflict banner
expected: Red-bordered banner with "Conflicto detectado" heading, server species name, and two action buttons
result: [pending]
blocked_by: physical-device
reason: "Requires second device with APK installed to generate conflict scenario"

### 4. Accept/keep conflict resolution actions
expected: Accept server changes species to server's choice; keep local dismisses banner and preserves local species
result: [pending]
blocked_by: physical-device
reason: "Requires second device with APK installed to generate conflict scenario"

### 5. SubGroupCard N/N badge colors
expected: Badge with secondaryYellowLight background, secondaryYellowDark text, secondaryYellowMedium border
result: pass

### 6. End-to-end N/N sync
expected: Subgroups with unresolved N/N trees upload successfully, trees arrive at server with especieId=null
result: pass

## Summary

total: 6
passed: 4
issues: 0
pending: 2
skipped: 0
blocked: 2

## Gaps
