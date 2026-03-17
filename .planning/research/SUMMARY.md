# Project Research Summary

**Project:** Bayka — Offline-first plantation monitoring mobile app
**Domain:** Ecological restoration field data collection (React Native / Expo)
**Researched:** 2026-03-16
**Confidence:** HIGH

## Executive Summary

Bayka is an offline-first field data collection app for ecological restoration teams. The domain is well-understood: apps like KoBoToolbox, ODK Collect, TreeMapper, and iNaturalist have established clear patterns for this class of software. What differentiates Bayka is its specialized UX contract — a species button grid designed for gloved hands walking planting lines, SubGroup-level atomic sync, and a strict immutability model that protects research data integrity. Experts in this space build with SQLite as the local source of truth, explicit user-initiated sync, and layered architecture that keeps the network completely out of the registration critical path.

The recommended approach is Expo SDK 55 + expo-sqlite + Drizzle ORM for the local layer, Supabase for auth and server-side storage, and a Repository + Service pattern that isolates all database and network access from the UI. This combination is the current community and official Expo consensus for offline-first React Native in 2025–2026. Manual sync via a Postgres RPC function is the correct model for Bayka's scale (2-10 devices, one organization, structured subgroup ownership). Automated sync solutions (PowerSync, WatermelonDB, Realtime) are overengineered for this context and introduce failure modes in no-connectivity environments.

The critical risks are not architectural complexity but operational correctness: Supabase auth sessions expire silently offline, SQLite sync writes must be atomic with outbox state, and the species grid must survive physical field conditions (gloves, sunlight, pace). All three are known failure patterns with documented prevention strategies. They must be addressed in the foundation phase — not retrofitted after the core is built.

---

## Key Findings

### Recommended Stack

The stack is settled with high confidence. Expo SDK 55 ships React Native 0.83 + New Architecture by default, making it the correct starting point for a new project in March 2026. expo-sqlite (~15.x via Expo SDK) paired with Drizzle ORM (0.45.x stable) is the explicit Expo-recommended combination for offline-first apps, with native migration support via `useMigrations` and a `useLiveQuery` hook that eliminates manual state management for reactive UI. Supabase client v2 handles auth and sync push/pull. Zustand is used only for transient UI state (sync status, active plantation context) — not for domain data, which lives exclusively in SQLite.

**Core technologies:**
- Expo SDK 55 (React Native 0.83): App framework — New Architecture default, eliminates legacy bridge
- expo-sqlite ~15.x + Drizzle ORM 0.45.x: Local persistence — typed schema, auto-migrations, live queries, first-class Expo support
- @supabase/supabase-js 2.99.x: Auth + sync backend — stable v2, handles RPC calls for atomic SubGroup upload
- Expo Router ~4.x: Navigation — file-based routing, typed routes, auth-gated layout guards
- expo-secure-store ~14.x: Auth token storage — OS keychain/keystore encryption, safer than AsyncStorage for JWTs
- expo-image-picker ~16.x: Photo capture — handles camera + gallery in one API call, required for N/N workflow
- Zustand 5.x: UI state only — sync status, active context; domain data never stored here

**What NOT to use:** Drizzle ORM v1.0 beta (breaking changes), Supabase Realtime for sync (requires persistent connectivity), expo-camera directly for simple capture (overkill), Expo Go for development (requires dev build for expo-sqlite + expo-secure-store).

See: `.planning/research/STACK.md`

### Expected Features

The core value proposition is one-tap tree registration via a species button grid, with SubGroup-level atomic sync and strict data lifecycle. Research confirms that generic tools (KoBoToolbox, ODK Collect) fail this use case because they are form-centric and not designed for physical-world registration pace.

**Must have (table stakes):**
- Offline-first data entry — fatal without it; field sites have no connectivity
- One-tap species registration — walking pace, gloved hands, no dialogs
- Clear sync state visibility — color-coded recording/finished/synced on every list item
- Persistent session / auth — field workers cannot re-login mid-task
- Role separation (admin / tecnico) — different navigation roots, different capabilities
- Photo capture for N/N trees — mandatory; enables field identification
- Manual sync initiation — user-controlled; auto-sync assumptions fail offline
- SubGroup state machine (recording -> finished -> synced) — enforces data integrity
- Immutability after sync — synced data is the research record
- N/N workflow (register + mandatory photo + resolve gate) — field reality
- Data export (CSV/Excel) — downstream ecological analysis requirement
- Sync conflict detection with plain-language error messages
- Admin: plantation creation, species config, technician assignment
- Admin: plantation finalization + ID generation
- Reverse order button — technicians walk lines both directions

**Should have (differentiators):**
- Species button grid sized for gloves (minimum 60x60pt touch targets)
- Sequential position tracking (embedded in SubID, enables spatial correlation)
- Admin-configurable species button order (matches physical planting layout)
- Today's tree count on dashboard (productivity tracking)
- SubGroup as atomic sync unit (vs. form-by-form in generic tools)
- Seeded SubID encoding (SubGroup + Species + Position, deterministic, no UUID risk)

**Defer (v2+):**
- GPS per SubGroup (schema supports it; defer UI)
- Photo upload to server (expensive over mobile; batch Wi-Fi upload in Phase 2)
- GIS export / GeoJSON (requires GPS data first)
- Multiple organizations (schema ready; UI not needed)
- Follow-up monitoring workflows (separate major feature)
- AI-assisted species identification (requires training data + connectivity)
- Real-time admin dashboard (separate web app concern)

See: `.planning/research/FEATURES.md`

### Architecture Approach

The architecture is a four-layer stack: Presentation (screens, components, hooks) -> Domain/Service (SyncService, PhotoService, IDGenerator) -> Repository (all SQLite access) -> Local Database (expo-sqlite + Drizzle). The Supabase backend is connected only through SyncService, which is invoked exclusively by user-initiated action. SQLite is the single source of truth at all times; the app writes locally first and always. `useLiveQuery` from Drizzle replaces manual React state for any data displayed in the UI, making the one-tap registration flow instantaneous with zero network involvement.

**Major components:**
1. Repository layer (SubGroupRepository, TreeRepository, PlantationRepository, SpeciesRepository) — the only layer that reads/writes SQLite; screens and hooks never import Drizzle directly
2. SyncService — coordinates pull (species catalog, remote SubGroups) then push (finished local SubGroups via single Postgres RPC); marks SubGroup synced only on server confirmation
3. Species button grid + live query hooks — critical path for registration performance; tree insert triggers live query -> UI re-render in <5ms with no network
4. SubGroup state machine — enforces recording -> finished -> synced lifecycle; SyncService only sees `finished` SubGroups; `synced` state is immutable
5. Expo Router layout guards — auth-gated routes via `_layout.tsx`; admin and tecnico navigation roots separated at file system level

**Key patterns:** Repository pattern over raw Drizzle (isolation + testability), live queries for reactive UI (eliminates stale state), atomic SubGroup sync via single RPC (no partial uploads), pull-then-push sync order (pull latest species/config before uploading local SubGroups).

**Anti-patterns to avoid:** Querying SQLite from screens directly, optimistic network writes (fatal in field), partial SubGroup sync, sync during active registration (race condition), auth-gating local SQLite reads.

See: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Supabase auth session expires offline** — Supabase auto-refresh calls fail offline and evict the session, logging users out in the field. Prevention: set JWT expiry to maximum (1 week); check connectivity before `startAutoRefresh()`; restore session from expo-secure-store on offline launch; distinguish "expired while online" (logout) from "refresh failed offline" (keep session). Must address in foundation phase.

2. **Outbox not atomic with domain write** — If SubGroup domain write and outbox write are separate SQLite operations, a crash between them leaves data in local DB but invisible to sync. Prevention: wrap both writes in a single `withExclusiveTransactionAsync` call; outbox record includes client-generated idempotency key; server enforces UNIQUE constraint on idempotency key. Must address before any sync UI.

3. **Non-atomic SubGroup sync on server** — Sending SubGroup + trees as sequential REST calls means a connection drop mid-upload leaves partial data on the server. Prevention: implement sync as a single Postgres RPC function that wraps all inserts in one transaction; client sends complete payload in one call; idempotency key makes retries safe. Design the RPC before writing any client sync code.

4. **SQLite schema migrations not handled for app updates** — Schema change without migration infrastructure wipes or crashes user data on app update. Prevention: use Drizzle `useMigrations` hook at app startup before any query executes; configure Metro to bundle `.sql` files; treat migrations as append-only. Must be in place before any schema is shipped.

5. **Species grid unusable under field conditions** — Small touch targets + glare + gloves = wrong species registered. Synced records are immutable so errors caught post-sync have no remedy. Prevention: minimum 60x60pt touch targets; undo last tree (no dialog); high-contrast scheme validated outdoors; test with thick gloves on physical device. Validate before any field testing.

6. **Unsynced data loss invisible to users** — No visual prominence of pending sync count leads to device loss or clear wiping unsynced data. Prevention: unsynced SubGroup count must be always visible (zero taps to see); prompt sync on SubGroup finalization when connected.

7. **N/N trees blocking sync at scale** — Multiple unresolved N/N trees at end-of-day cause workers to bulk-guess species or skip sync. Prevention: photo thumbnails must load from local storage (never network); show N/N count prominently on SubGroup card; allow partial resolution with save.

See: `.planning/research/PITFALLS.md`

---

## Implications for Roadmap

Based on combined research, the natural build order follows the dependency chain from ARCHITECTURE.md, gated by the pitfall prevention requirements from PITFALLS.md. The feature dependency tree from FEATURES.md confirms that the lower layers (auth, schema, repositories) must exist before any user-visible feature can function.

### Phase 1: Foundation

**Rationale:** Every subsequent phase depends on the database schema, migration infrastructure, auth session handling, and Supabase client setup. The three highest-severity pitfalls (auth offline, outbox atomicity, migration failure) are all foundation-layer concerns. Addressing them here prevents retrofitting correctness into working code later.

**Delivers:** Working SQLite schema with Drizzle ORM + migrations, Supabase client configured for offline-safe auth, expo-secure-store session persistence, project structure with repository layer in place, Metro configured for .sql bundling, WAL mode enabled, development environment with Drizzle Studio.

**Addresses features:** Persistent session / auth, role detection on login, seeded species + users.

**Avoids pitfalls:** Auth session expiry offline (Pitfall 1), schema migration failure on app update (Pitfall 4), SQLite performance degradation without WAL (Performance Traps section), AsyncStorage for auth tokens (Security Mistakes section).

**Research flag:** Standard patterns. Official Expo docs + Drizzle docs provide complete setup guidance. No additional research needed.

### Phase 2: Core Data Layer + Repository

**Rationale:** With schema and auth in place, define all repositories and live query hooks before building any screens. Screens must never import Drizzle directly — establishing this boundary now prevents the anti-pattern from spreading.

**Delivers:** PlantationRepository, SubGroupRepository, TreeRepository, SpeciesRepository — all with typed queries and live query hooks. SubGroup state machine implemented in the repository layer. IDGenerator utility (SubID computation).

**Addresses features:** SubGroup state machine (recording -> finished -> synced), sequential position tracking, SubID generation.

**Avoids pitfalls:** Querying SQLite from screens directly (Architecture anti-pattern 1).

**Research flag:** Standard patterns. Repository + live query pattern is well-documented.

### Phase 3: Auth + Navigation Shell

**Rationale:** Auth flow and navigation shell are prerequisites for any screen. Role-based routing (admin vs. tecnico) must be established before building either role's screens. Auth is online-only at login but must handle offline gracefully after first session.

**Delivers:** Login screen, Expo Router layout guards, role-based navigation roots (admin branch, tecnico branch), offline session restoration from expo-secure-store.

**Addresses features:** Role separation (admin / tecnico), persistent session.

**Avoids pitfalls:** Auth session expires offline (Pitfall 1) — offline session restoration is implemented here as part of auth flow.

**Research flag:** Standard patterns. Expo Router auth guards + Supabase session management are well-documented.

### Phase 4: Tree Registration Core

**Rationale:** This is the highest-value, most performance-sensitive screen and the primary validation target for the product. Building it early allows field testing before peripheral features exist. The one-tap registration flow and live query pattern are validated here first.

**Delivers:** Species button grid screen (plantation-scoped, admin-configured order), one-tap tree registration (SQLite insert -> live query -> re-render in <5ms), undo last tree (no dialog), N/N tree registration with mandatory photo capture, last 3 registered trees display.

**Addresses features:** Species button grid, one-tap registration, N/N workflow (registration half), photo capture.

**Avoids pitfalls:** Species grid field usability (Pitfall 5) — 60x60pt touch targets, undo last tree, high-contrast scheme; photo stored to documentDirectory not temp (Stack patterns section).

**Research flag:** Needs validation. The species grid UX under real field conditions (gloves, sunlight) requires physical device testing before this phase is "done." No additional technology research needed, but UX validation is mandatory.

### Phase 5: SubGroup Management + N/N Resolution

**Rationale:** SubGroup lifecycle management wraps around tree registration. N/N resolution must exist before sync can exist (it is a sync gate). The SubGroup finalization flow (recording -> finished) triggers the N/N resolution prompt.

**Delivers:** SubGroup creation + list screen, SubGroup finalization (recording -> finished) with N/N gate, N/N resolution screen (photo from local storage, species assignment), reverse order button (position recalculation pre-finalization), sync status visibility on SubGroup cards (color-coded chips).

**Addresses features:** SubGroup management, SubGroup state machine, N/N resolution gate, reverse order button, sync state visibility.

**Avoids pitfalls:** N/N blocking sync at scale (Pitfall 7) — N/N count prominent on SubGroup card, photos from local storage; unsynced data loss visibility (Pitfall 6) — color-coded state on every SubGroup card.

**Research flag:** Standard patterns for state machine and navigation. N/N resolution flow has no external research needed — defined by domain spec.

### Phase 6: Sync Service

**Rationale:** Sync is the reason the app exists, but it is the last domain feature because it depends on the complete SubGroup lifecycle (recording -> finished) being functional. The Postgres RPC must be designed and tested before the client sync code is written.

**Delivers:** SyncService (pull remote species/config then push finished SubGroups), outbox record written atomically with SubGroup domain write (`withExclusiveTransactionAsync`), Postgres RPC function (SubGroup + trees in single transaction), client idempotency key, SubGroup marked synced only on server confirmation, conflict detection (duplicate SubGroup code) with plain-language error, sync result summary screen, prominent unsynced SubGroup count badge.

**Addresses features:** Manual sync, atomic SubGroup sync unit, sync conflict detection, download updated data on sync, unsynced data visibility.

**Avoids pitfalls:** Outbox not atomic with domain write (Pitfall 2), non-atomic server sync (Pitfall 3), unsynced data loss invisible (Pitfall 6 — badge always visible).

**Research flag:** Needs deeper research. The Postgres RPC implementation (server-side transaction for SubGroup + trees upsert, idempotency logic, RLS policy setup) requires careful design. Recommend a research-phase task for the Supabase backend schema and RPC before implementation starts.

### Phase 7: Dashboard + Plantation Flow

**Rationale:** Dashboard and plantation-level views are needed for daily use but depend on the sync flow being functional to display accurate stats from multiple technicians. Building after sync ensures dashboard stats reflect real multi-user data.

**Delivers:** Dashboard screen (plantation list, tree count totals, today's count), plantation detail screen (SubGroup list with sync status badges), sync trigger from plantation screen, stats query hooks.

**Addresses features:** Dashboard with progress stats, today's tree count, plantation view.

**Avoids pitfalls:** Sync button buried in menu (UX Pitfalls section) — sync CTA on plantation screen, always accessible.

**Research flag:** Standard patterns. Simple live queries + navigation structure.

### Phase 8: Admin Features

**Rationale:** Admin features (plantation creation, species config, technician assignment, finalization, ID generation, export) are needed before the first real planting season but have lower field risk than the registration and sync flows. They can be built and tested in non-field conditions.

**Delivers:** Admin: create plantation (lugar + periodo), configure species per plantation from seeded catalog, assign technicians, finalize plantation (locks further SubGroup creation), generate plantation-sequential IDs + global org IDs, export to CSV/Excel (ExportService).

**Addresses features:** Admin plantation creation + species config, plantation finalization, ID generation, CSV/Excel export.

**Avoids pitfalls:** In-app species management (anti-feature — do not allow catalog edits), CSV export before ID generation (block until finalization complete).

**Research flag:** Standard patterns for admin screens. ID generation algorithm and CSV export format are defined in domain spec (SPECS.md). No external research needed.

### Phase Ordering Rationale

- Foundation before everything: schema, migrations, and auth session handling must be correct before any feature can be trusted.
- Repository layer before screens: enforces the architectural boundary that screens never touch Drizzle directly.
- Tree registration before SubGroup management: validates the performance-critical critical path early; SubGroup management wraps around it.
- N/N resolution before sync: it is a hard gate for sync; building them out of order forces rework.
- Sync before dashboard: dashboard stats are only meaningful when sync is functional.
- Admin after core field flows: field risk (data loss) is higher than admin configuration risk; validate the dangerous path first.

### Research Flags

Phases needing deeper research during planning:

- **Phase 6 (Sync Service):** The server-side Postgres RPC design (transaction scope, idempotency key schema, RLS policies for sync endpoint) is the most implementation-sensitive area. Recommend a dedicated research-phase task covering: Supabase RPC function syntax for multi-table inserts, RLS interaction with RPCs, and idempotency constraint design.

Phases with standard, well-documented patterns (skip research-phase):

- **Phase 1 (Foundation):** Expo + Drizzle + expo-secure-store setup is fully covered by official docs.
- **Phase 2 (Repository layer):** Repository pattern over Drizzle is a standard TypeScript pattern.
- **Phase 3 (Auth + Navigation):** Expo Router auth guards + Supabase session management are official-doc-level documentation.
- **Phase 5 (SubGroup Management):** State machine and navigation patterns are standard; domain rules are defined in SPECS.md.
- **Phase 7 (Dashboard):** Simple query + navigation work.
- **Phase 8 (Admin):** Form-based admin screens with no novel patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core packages verified against official Expo, Drizzle, and Supabase docs with specific version numbers. SDK 55 confirmed stable March 2026. |
| Features | HIGH | Verified against 5 reference apps (KoBoToolbox, ODK, TreeMapper, iNaturalist, TREEO) + 2024 Restoration Ecology review paper + Bayka internal SPECS.md. |
| Architecture | HIGH | Patterns verified against official Expo local-first guide + multiple production implementation articles. Build order implications cross-verified with feature dependency tree. |
| Pitfalls | HIGH | Multiple independent sources converge on the same failure modes. Three critical pitfalls have linked GitHub issues and community discussions confirming real-world occurrence. |

**Overall confidence:** HIGH

### Gaps to Address

- **Supabase backend schema design:** The server-side schema (tables, RLS policies, RPC function) has not been researched in detail. The client-side architecture is clear, but the Postgres RPC implementation for atomic SubGroup sync needs a focused research task before Phase 6.

- **Offline auth edge cases:** The community discussion sources on Supabase offline auth handling are MEDIUM confidence (community, not official docs). The implementation strategy is sound in principle, but the exact `onAuthStateChange` event sequence for offline-offline-reconnect cycles should be validated with a prototype before Phase 3 ships.

- **Photo storage at scale:** Phase 1 is local-only (correct decision). Phase 2 photo upload strategy (batch Wi-Fi, Supabase Storage costs, compression) is not researched. Flag this for a separate research task when Phase 2 is scoped.

- **Export format specifics:** CSV/Excel column structure, ID format, and any regulatory or research standard requirements are defined in SPECS.md but not independently validated against ecological data standards. If the research team has specific format requirements, confirm before implementing ExportService in Phase 8.

---

## Sources

### Primary (HIGH confidence)
- Expo SQLite official docs (https://docs.expo.dev/versions/latest/sdk/sqlite/) — expo-sqlite features, Drizzle integration, persistence
- Expo Local-First Architecture Guide (https://docs.expo.dev/guides/local-first/) — recommended solutions, architectural patterns
- Expo Blog: Modern SQLite for React Native (https://expo.dev/blog/modern-sqlite-for-react-native-apps) — Drizzle + expo-sqlite recommendation rationale
- Drizzle ORM + Expo SQLite docs (https://orm.drizzle.team/docs/connect-expo-sqlite) — setup, Metro config, version requirements
- Expo SDK 55 changelog (https://expo.dev/changelog/sdk-55) — SDK 55 stable, RN 0.83, package versioning
- Supabase Expo React Native quickstart (https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native) — required packages
- expo-secure-store official docs (https://docs.expo.dev/versions/latest/sdk/securestore/) — encrypted storage
- Row Level Security — Supabase Docs (https://supabase.com/docs/guides/database/postgres/row-level-security)
- Bayka internal: SPECS.md, domain-model.md, ui-ux-guidelines.md

### Secondary (MEDIUM confidence)
- Building Offline-First Production-Ready Expo App with Drizzle ORM (Medium/@detl) — production patterns
- Offline-First React Native Architecture with SQLite (InnovationM) — architecture patterns
- React Native offline sync with SQLite queue (DEV.to/sathish_daggula) — sync implementation patterns
- Offline-First React Native Apps with Expo, WatermelonDB, and Supabase (Supabase Blog) — alternative sync patterns
- PowerSync: Bringing Offline-First To Supabase — automated sync alternative (evaluated and rejected)
- React Native Tech Stack 2025 (Galaxies.dev) — community consensus on state management
- Review and assessment of smartphone apps for forest restoration monitoring (Restoration Ecology 2024) — feature benchmarking
- TreeMapper by Plant-for-the-Planet — reference forestry app patterns

### Tertiary (MEDIUM-LOW confidence, community)
- Supabase auth session lost when starting app offline (GitHub Discussion #36906) — offline auth failure mode confirmed
- Token refresh fails silently when offline (supabase/auth-js Issue #226) — auth pitfall mechanism
- How to handle Supabase Auth in offline-first React Native (AnswerOverflow) — session handling approach

---

*Research completed: 2026-03-16*
*Ready for roadmap: yes*
