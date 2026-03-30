# Phase 5: UX Improvements - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Quality-of-life improvements for field use: connectivity awareness (online/offline indicator), automatic data freshness checks with user-initiated refresh, complete profile screen, and contextual header titles. No new core features — polish and awareness for existing functionality.

</domain>

<decisions>
## Implementation Decisions

### Connectivity Feedback
- Subtle icon in the header area (e.g., cloud with checkmark/X) — not a persistent banner or toast
- Icon changes color on transition (green → gray/red) without a separate notification
- Rationale: field conditions have constant connectivity flicker — banners would be annoying and distracting
- Centralize connectivity state in a `useNetStatus()` hook wrapping NetInfo (currently used ad-hoc via `NetInfo.fetch()` in auth.ts and AssignTechniciansScreen)
- Add online/offline state colors to `src/theme.ts`

### Data Freshness Check
- Check for server updates **on screen focus** when entering PlantacionesScreen (not periodic, not background)
- Compare local vs server timestamps on plantations/subgroups to detect changes
- Show inline banner below the header with "Hay datos nuevos disponibles" + "Actualizar" button
- Banner is dismissible and non-blocking — user decides when to pull
- Reuse existing `pullFromServer()` from SyncService for the actual data refresh
- Requires connectivity — if offline, skip the check silently (offline-first principle)

### Profile Screen
- Read-only display: nombre, email, rol, organización
- Fetch from Supabase `profiles` table (extends existing pattern in useAuth/adminQueries)
- Cache profile data locally after first fetch to support offline viewing
- No edit functionality — editing profiles is out of scope for v1
- Current PerfilScreen only shows role + logout button — expand with profile card

### Contextual Plantaciones Header
- Tecnico sees: "Mis plantaciones" as header title
- Admin sees: organization name as header title (fetched from profiles → organizations)
- Replace current static "Bayka" title in PlantacionesScreen
- Online/offline indicator integrated into this header area

### Background Species Catalog Updates
- When freshness check detects changes, species catalog is included in the pull
- No separate "species sync" — piggyback on existing `pullFromServer()` which already downloads species
- This is essentially "data freshness check includes species" — no new mechanism needed

### Claude's Discretion
- Exact icon choice for connectivity indicator (Ionicons has cloud/wifi variants)
- Banner animation and styling details
- Profile card layout within PerfilScreen
- How to cache profile data (SecureStore vs SQLite)
- Freshness check debounce/cooldown to avoid excessive server calls

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Project-level
- `.planning/PROJECT.md` — Core value, constraints, out-of-scope list
- `.planning/REQUIREMENTS.md` — v1 requirements (all complete), v2 deferred items

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@react-native-community/netinfo` (v11.4.1): Already installed, used in `supabase/auth.ts` and `screens/AssignTechniciansScreen.tsx` via direct `NetInfo.fetch()` calls
- `SyncService.pullFromServer()`: Complete pull logic for plantations, subgroups, trees, species — can be reused for freshness refresh
- `useSync` hook: Wraps SyncService with progress state — can be extended or a lighter version created for pull-only
- `CustomHeader` component: Exists with `title`, `subtitle`, `onBack`, `rightElement` props — connectivity icon can go in `rightElement`
- `src/theme.ts`: Centralized colors/spacing — add connectivity state colors here
- `useAuth` hook: Already fetches role from Supabase profiles — extend to fetch full profile data
- `useLiveData` hook: Reactive data pattern — can be used for cached profile data

### Established Patterns
- Queries in `src/queries/`, repositories in `src/repositories/`, services in `src/services/`
- Screens never import `db` directly — all data access through query/repository layer
- Modal-based feedback (SyncProgressModal, ConfirmModal) — no toast library
- Supabase client accessed directly in hooks/queries (no abstraction layer)
- SecureStore for auth tokens, role caching

### Integration Points
- **Header**: `PlantacionesScreen.tsx` lines 58-60 — replace static "Bayka" with dynamic title + connectivity icon
- **Profile**: `PerfilScreen.tsx` — currently only shows role + logout, expand with profile card
- **Auth hook**: `useAuth.ts` — extend to expose user metadata (name, email, org)
- **Theme**: `theme.ts` — add `colors.online`, `colors.offline` state colors
- **Tab layouts**: `app/(admin)/_layout.tsx` and `app/(tecnico)/_layout.tsx` — where tab headers are configured
- **Sync**: `SyncService.ts` `pullFromServer()` — reuse for freshness pull

</code_context>

<specifics>
## Specific Ideas

- Connectivity icon should be subtle and not draw attention unless status changes — field workers shouldn't be distracted by it
- Freshness banner should feel like the "Actualizar datos" button already on PlantationDetailScreen — consistent pattern
- Profile screen should feel informational, not like a settings page

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-ux-improvements*
*Context gathered: 2026-03-28*
