# Phase 12: Persistir imágenes de árboles en Supabase Storage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 12-persistir-im-genes-de-rboles-en-supabase-storage-con-toggle-resize-y-sync
**Areas discussed:** Upload timing & trigger, Resize strategy, Toggle behavior, Server storage & URL mapping

---

## Upload Timing & Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| During SubGroup sync | Photos upload as part of existing syncPlantation flow | ✓ (base) |
| Separate manual action | Dedicated 'Upload photos' button | |
| Immediate on capture | Each photo uploads as soon as taken | |

**User's choice:** During sync, but with two key modifications:
1. Split sync into two buttons (Descargar + Subir) in the same line
2. Each button gets a checkbox "Incluir fotos"

**Notes:** User raised important follow-up: what if user skips photos and wants to upload later? Decision: re-sync with checkbox on — SubGroups already sincronizada so only photos upload. User also raised the idea of syncing N/N subgroups for remote identification, but this was deferred to Phase 13.

### Scope Creep Discussion (deferred to Phase 13)
User proposed several major changes during this area:
- Sync button on plantation card
- Rethinking finalizado/sincronizado states
- Reopening synchronized SubGroups
- Admin editing other users' SubGroups
- Syncing open (activa) SubGroups
- Tracking editors on subgroups and trees

All deferred to Phase 13 (Sync Redesign) after analysis of complications.

---

## Resize Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| 1024px lado mayor | ~200-400KB, good balance | |
| 1600px lado mayor | ~400-800KB, more detail for botanical ID | ✓ |
| Solo compresión JPEG | Original dimensions, lower quality | |

**User's choice:** 1600px on longest side

| Option | Description | Selected |
|--------|-------------|----------|
| Al capturar | Resize in PhotoService during save | ✓ |
| Al subir | Resize just before upload | |

**User's choice:** At capture time. User asked about performance impact — clarified ~100-200ms is imperceptible after camera interaction, and PhotoService already copies the file so resize replaces that operation.

---

## Toggle Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Recordar por plantación | Per-plantation persistence in SQLite | |
| Recordar globalmente | Single global preference in SecureStore | |
| Siempre activado por defecto | Always ON, no persistence | ✓ |

**User's choice:** Always ON by default, no persistence.

---

## Server Storage & URL Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| plantations/{id}/trees/{treeId}.jpg | Per-plantation organization | ✓ |
| tree-photos/{treeId}.jpg | Flat structure | |
| orgs/{orgId}/plantations/{id}/{treeId}.jpg | Per-organization nesting | |

**User's choice:** Per-plantation structure

| Option | Description | Selected |
|--------|-------------|----------|
| Path relativo | Store relative path, resolve URL at display time | ✓ |
| URL completa | Store full Supabase Storage URL | |

**User's choice:** Relative path. User asked for recommendation — Claude explained: decoupled from provider, consistent with local paths, necessary anyway for signed URLs on private buckets.

| Option | Description | Selected |
|--------|-------------|----------|
| Privado con RLS | Authenticated access only, signed URLs | ✓ |
| Público | Anyone with URL can access | |

**User's choice:** Private with RLS

---

## Claude's Discretion

- Image manipulation library choice
- RLS policy specifics
- Error handling for partial failures
- Local photo cleanup strategy
- Migration details

## Deferred Ideas

- Phase 13: Sync Redesign — eliminate sincronizado state, reopen synced SubGroups, admin editing, sync activos, N/N remote resolution, conflict resolution, audit trail
