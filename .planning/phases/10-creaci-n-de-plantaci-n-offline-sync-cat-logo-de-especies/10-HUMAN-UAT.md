---
status: partial
phase: 10-creaci-n-de-plantaci-n-offline-sync-cat-logo-de-especies
source: [10-VERIFICATION.md]
started: 2026-04-08T15:30:00.000Z
updated: 2026-04-08T15:30:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Offline plantation creation UI flow
expected: Create plantation in airplane mode, verify "Pendiente de sync" badge appears, verify species config works offline, verify finalization blocked with "Sincroniza primero", verify tech assignment blocked with "Sin conexion"
result: [pending]

### 2. Sync clears pending badge
expected: Re-enable network, trigger sync, verify badge disappears and plantation exists in Supabase
result: [pending]

### 3. organizacionId on offline cold start
expected: Log in online, force-kill app, enable airplane mode, re-launch, verify plantation creation doesn't fail on null organizacionId
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
