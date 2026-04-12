---
status: partial
phase: 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
source: [12-VERIFICATION.md]
started: 2026-04-12T15:00:00Z
updated: 2026-04-12T15:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Photo resize verification
expected: Captured photos are 1600px on longest side when viewed in the app
result: [pending]

### 2. Push sync with Incluir fotos checked
expected: SyncProgressModal shows 'Subiendo fotos...' state with 'N de M fotos' counter after SubGroup sync completes
result: [pending]

### 3. Pull sync with Incluir fotos checked
expected: SyncProgressModal shows 'Descargando fotos...' state and downloads photos to local storage
result: [pending]

### 4. Incluir fotos unchecked skips photo step
expected: Uncheck 'Incluir fotos', run sync — modal never shows photo progress state, completes without photo upload/download
result: [pending]

### 5. Amber dot visible on unsynced photo tree in TreeListModal
expected: Tree with fotoUrl set and fotoSynced=false shows amber dot at top-right of image icon in the tree list
result: [pending]

### 6. Dark blue dot visible on synced photo tree in TreeListModal
expected: Tree with fotoUrl set and fotoSynced=true shows dark blue dot at top-right of image icon
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
