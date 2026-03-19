# Pitfalls Research

**Domain:** Offline-first mobile data collection — ecological restoration / plantation monitoring
**Researched:** 2026-03-16
**Confidence:** HIGH (multiple sources converge on the same failure modes)

---

## Critical Pitfalls

### Pitfall 1: Supabase Auth Session Expiry Kills Offline Use

**What goes wrong:**
When a user launches the app without internet access after their JWT access token has expired, Supabase Auth attempts to call the refresh token endpoint, fails silently, and logs the user out. The user arrives at the plantation, opens the app, and cannot access their data — even though all their local SQLite records are intact.

**Why it happens:**
Supabase's JS client calls `startAutoRefresh()` on initialization, which fires network requests to refresh the session. When offline, these requests fail. The client interprets repeated failures as an invalid session and clears it. Access tokens default to 1-hour expiry; refresh tokens never expire but require network contact to exchange. The `persistSession: true` flag only persists the token to storage — it does not protect against auto-refresh eviction.

**How to avoid:**
- Set JWT access token expiry to the maximum practical value in Supabase dashboard (up to 1 week or longer for field contexts).
- On app startup, check connectivity before calling `startAutoRefresh()`. If offline, skip the auto-refresh call and keep the local session active.
- Store the session in AsyncStorage with SecureStore fallback. On offline launch, restore session from storage without triggering a refresh.
- Implement an `onAuthStateChange` handler that distinguishes between "token expired while online" (force logout) and "refresh failed while offline" (keep session).
- Test explicitly: launch the app in airplane mode 2+ hours after last use.

**Warning signs:**
- Users report being "logged out" when in the field with no connectivity.
- Auth state listener fires `SIGNED_OUT` events when the device is offline.
- Login screen appears on app launch despite user having logged in before.

**Phase to address:** Foundation / Architecture phase — must be solved before any field testing.

---

### Pitfall 2: Outbox Not Written in the Same SQLite Transaction as Domain Data

**What goes wrong:**
A technician records 40 trees, taps "Sync," and the app reports success — but the server never receives the data. This happens when the sync queue (outbox) is managed in memory or AsyncStorage separately from the SQLite domain tables. If the app crashes between writing to the domain table and writing to the outbox, the sync queue has no record of the pending data. The UI shows the trees; the server never sees them.

**Why it happens:**
Developers treat the outbox as a secondary concern and add it after the domain logic. The domain write ("save the SubGroup") and the outbox write ("schedule this SubGroup for sync") happen in two separate operations. Any crash, backgrounding, or OOM between those two operations leaves the system in an inconsistent state.

**How to avoid:**
- Write the SubGroup to the domain table AND insert the outbox record in a **single SQLite transaction**. Either both succeed or neither does.
- Use `withExclusiveTransactionAsync` (expo-sqlite) for all outbox-coupled writes.
- The outbox record should store the SubGroup ID, status (`pending`/`sent`/`failed`), and an idempotency key generated on the client at write time.
- The server must enforce a UNIQUE constraint on idempotency key to deduplicate retries.

**Warning signs:**
- Trees appear in local UI but are missing from Supabase after sync.
- Sync queue shows 0 items after a crash despite visible local data.
- Duplicate records appearing in Supabase after network retries.

**Phase to address:** Sync Architecture phase — before implementing any sync UI.

---

### Pitfall 3: SubGroup Sync Not Truly Atomic on the Server Side

**What goes wrong:**
The sync sends a SubGroup and its 200 trees. The server inserts the SubGroup row and 150 tree rows before the connection drops. The next sync attempt sends the same payload again. Now the server has a partial SubGroup + 150 trees from attempt 1, and an attempt to insert a duplicate SubGroup or 200 more trees. The result is corrupt or duplicated data.

**Why it happens:**
Implementing an atomic upsert across multiple tables (SubGroups + Trees in a single request) requires a server-side transaction with proper rollback. Developers frequently send the payload as a sequence of REST calls rather than a single transactional RPC, which is not atomic.

**How to avoid:**
- Implement sync as a Supabase **PostgreSQL RPC function** (Edge Function or `rpc()` call) that wraps SubGroup + Tree inserts in a single database transaction. If any tree insert fails, the entire operation rolls back.
- The client sends the complete SubGroup payload as a single JSON body to one endpoint.
- Use the client-generated idempotency key as a guard: if the SubGroup code already exists and is marked `sincronizada`, return 200 without re-inserting. This makes the operation safe to retry.
- After server confirmation, mark the local SubGroup as `sincronizada` and set immutability flag.

**Warning signs:**
- Partial SubGroups visible in the admin dashboard.
- SubGroup exists in server but has fewer trees than the local count.
- Sync succeeds on retry but tree count is doubled.

**Phase to address:** Sync Architecture phase — design the server RPC before writing any client sync code.

---

### Pitfall 4: SQLite Schema Migrations Not Handled for App Updates

**What goes wrong:**
Version 1.0 ships with a `trees` table. Version 1.1 adds a `notes` column. A field technician updates the app mid-season. On launch, the app crashes because the new code queries a column that doesn't exist in their existing SQLite database. All their local data is intact, but the app is unusable until they wipe and reinstall (losing unsynced data).

**Why it happens:**
SQLite in React Native/Expo is a local file. The ORM (Drizzle) generates migration SQL files at development time. Those files must be bundled with the app binary and executed on startup against the existing database. Developers forget to: (a) run `drizzle-kit generate` after schema changes, (b) configure Metro to bundle `.sql` files, (c) run migrations before any component renders.

**How to avoid:**
- Use Drizzle ORM with `useMigrations` hook to run all pending migrations on app startup, before any SQLite query executes.
- Configure `metro.config.js` to include `.sql` files in the bundle (required for Drizzle to find migration files).
- Treat migrations as append-only: never modify an existing migration file, only add new ones.
- Test migration paths explicitly: install v1.0, populate data, upgrade to v1.1, verify data survives.
- Keep a `schema_version` table to track applied migrations.

**Warning signs:**
- App crashes on startup after an update with a "no such column" SQLite error.
- Metro bundler silently ignores `.sql` files (check bundle output).
- `drizzle-kit generate` hasn't been run after a schema change.

**Phase to address:** Foundation phase — set up migration infrastructure before writing any domain schema.

---

### Pitfall 5: Species Button Grid Becomes Unusable Under Real Field Conditions

**What goes wrong:**
The species grid looks fine on a desk: 20 buttons, legible labels. In the field: direct sunlight washes out the screen, dirty gloves miss small touch targets, and technicians register the wrong species at speed. A 20-minute planting session produces a SubGroup that must be manually corrected or re-done. Since sincronizada SubGroups are immutable, an error caught after sync has no remedy in Phase 1.

**Why it happens:**
Developers test UI on simulators or in office conditions. Touch targets are sized by "looks reasonable" rather than HIG/Material minimums for gloved use. Screen contrast is evaluated without simulating sunlight wash-out. One-tap registration with no confirmation dialog is correctly prioritized for speed, but this makes accidental taps irreversible without per-species undo.

**How to avoid:**
- Minimum touch target: **60x60pt** for species buttons (Apple HIG minimum is 44pt; gloved use needs more).
- Test the species grid with thick winter gloves on a device, outdoors, at noon.
- Support undo of the **last registered tree only** (simple decrement, no confirmation dialog) — this handles accidental taps without adding friction.
- Use high-contrast color scheme (dark text on light background, or light on dark) verified under simulated bright sunlight (max screen brightness + glare screen filter test).
- Species button labels must be legible at arm's length (minimum 16pt bold, truncate with tooltip if necessary).
- Do not render more than 20-24 species buttons on a single screen without scroll — beyond that, chunking or search is needed.

**Warning signs:**
- Testers make accidental registrations during in-office testing.
- Species button labels are truncated to illegibility on smaller phones.
- Users request a "delete last tree" feature post-launch.

**Phase to address:** UI / Tree Registration phase — validate with real gloves before shipping.

---

### Pitfall 6: Unsynced Data Loss on App Clear or Device Replacement

**What goes wrong:**
A technician records two days of planting work. Before syncing, they accidentally clear the app's storage via device settings, or their phone breaks and they get a replacement. All local SQLite data is gone. Since sync was not completed, the server has none of it. The season's data for those SubGroups is permanently lost.

**Why it happens:**
Offline-first apps store data only locally until the user syncs. This is intentional, but users frequently don't understand this means local-only until sync. There is no backup, no auto-save to the server, and no recovery path once local storage is cleared.

**How to avoid:**
- Make the sync status **visually prominent and persistent** — a badge or banner on the plantation screen showing "X SubGroups not synced" at all times.
- When the technician finishes registering a SubGroup and taps "Finalize," immediately prompt sync if connectivity is available. Don't make them navigate to a separate sync screen.
- Include a prominent in-app warning before any destructive action that would lose unsynced data.
- Consider exposing a "what's at risk" screen: "You have 3 SubGroups with 847 trees that have not been synced. Sync before logging out."
- On Android, ensure SQLite database is in a directory excluded from automatic backup/restore to avoid stale data on new devices (restore from backup would bring old data without sync status).

**Warning signs:**
- Users don't look at sync status after recording.
- No visual distinction between "pending sync" and "synced" SubGroups in the list view.
- Sync is buried in a menu rather than available from the main plantation view.

**Phase to address:** UI / SubGroup Management phase — sync status must be a first-class UI element from day one.

---

### Pitfall 7: N/N Trees Blocking Sync at Scale

**What goes wrong:**
A technician records a long planting line and marks 15 trees as N/N (unidentified). The rule is that N/N trees must be resolved before sync. At end-of-day, with poor connectivity and tired workers, the resolve step is skipped or rushed. Either the SubGroup never syncs, or N/N trees are bulk-resolved with incorrect species to unblock sync.

**Why it happens:**
N/N resolution is a post-hoc identification step that requires re-examining photos. This is cognitively expensive at the end of a field day. If the resolution flow is buried or friction-heavy, workers take shortcuts. If resolution is blocked by network issues (can't load the photo thumbnail), the flow becomes impossible offline.

**How to avoid:**
- Photo thumbnails for N/N resolution must load from **local storage**, not the network. Never fetch photos from a remote URL during resolution.
- Show the N/N count prominently on the SubGroup card: "3 unresolved N/N trees — cannot sync."
- Allow partial resolution: resolve some N/N trees and save progress, come back to finish later.
- When the technician registers an N/N tree, immediately prompt for the photo capture (while still at the tree). This increases resolution quality vs. trying to identify from a photo taken days later.

**Warning signs:**
- Photo for N/N cannot load offline (indicates photos are being fetched from network).
- Workers resolve N/N trees in bulk at end-of-session by guessing species.
- SubGroups pile up in "pending" state because N/N resolution is never completed.

**Phase to address:** Tree Registration + Sync phases — define the N/N resolution flow explicitly before implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| AsyncStorage for sync queue instead of SQLite outbox | Simpler initial implementation | Duplicate/lost syncs; impossible to make atomic with domain writes | Never — use SQLite from day one |
| Multiple REST calls for SubGroup sync instead of single RPC | Easier to debug individual steps | Non-atomic sync; partial data on server after connection drop | Never — one RPC from day one |
| Skip drizzle migration setup, recreate DB on schema change | No migration code to write | Wipes all local user data on every app update | Never — set up migrations in Phase 1 |
| Inline species name in tree record instead of FK to species table | Faster to query | Species rename breaks historical data; sync conflicts on species name changes | Never for sincronizada data |
| Synchronous SQLite calls on main thread | Simpler code | UI freezes during heavy write operations (e.g., syncing 500 trees) | Never — use async API |
| Store photos as base64 in SQLite | Single storage location | Memory spikes; SQLite file bloat; app crashes on low-end devices | Never — store as file path + local URI |
| Hardcode Supabase URL + anon key in source | Works immediately | Secret exposure if repo is ever public; no environment switching | Only if repo stays private forever and no staging/prod split needed |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth | Calling `startAutoRefresh()` unconditionally on app start | Check connectivity first; skip refresh if offline; restore session from secure storage |
| Supabase RLS | Defaulting to anon token when user session is not set in client | Always set session before any Supabase client call; verify `auth.uid()` is non-null in RLS policies |
| Supabase RLS | Using `user_metadata` claims in RLS policies | Use custom JWT claims for roles; `user_metadata` is user-editable |
| Supabase RPC | Sending SubGroup + Trees as separate REST calls | Use a single `rpc()` call wrapping all inserts in a server-side Postgres transaction |
| expo-sqlite + Drizzle | Forgetting to configure Metro to bundle `.sql` migration files | Add `withSQLiteProvider` config and Metro `.sql` extension in `metro.config.js` |
| expo-sqlite | Reading photos as base64 through SQLite | Store photos in `expo-file-system` directory; keep only file URI in SQLite |
| expo-file-system | Loading entire photo files into memory for display | Use `<Image source={{ uri: localFileUri }}>` — RN handles streaming; never read file bytes manually |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Inserting trees one-by-one outside a transaction | UI freezes for 1-2 seconds per batch during sync | Wrap all tree inserts for a SubGroup in a single `withExclusiveTransactionAsync` | At ~50+ trees per SubGroup |
| Rendering all species buttons without memoization | Species grid re-renders on every tree registration (state update) | `React.memo` on species buttons; only re-render the count badge | At ~20 species buttons |
| Loading all SubGroups with all trees in a single query | Plantation screen becomes slow to load | Lazy-load tree counts as aggregates; load individual trees only when SubGroup is opened | At ~10 SubGroups with 200+ trees each |
| No WAL mode on SQLite | Read and write operations block each other | Enable WAL mode on database creation: `PRAGMA journal_mode=WAL` | At any concurrent read/write, which happens during sync |
| Sync payload too large (photos included) | Sync takes 10+ minutes in the field; timeouts | Photos are local-only in Phase 1 (correct decision already made) | At ~100 trees with photos in a single sync payload |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-sent `user_id` in sync payload | Technician A can submit data under Technician B's identity | Server derives identity from JWT claims via RLS; never accept `user_id` in request body |
| No RLS on `subgroups` and `trees` tables | Any authenticated user can read or modify any plantation's data | Apply RLS: technicians see only their assigned plantations; admins see all |
| Storing Supabase service role key in mobile app | Full database access if key is extracted from APK/IPA | Never use service role key on client; use anon key + RLS only |
| Allowing duplicate SubGroup codes per plantation | Data integrity failure; ambiguous sync results | UNIQUE constraint on `(plantation_id, subgroup_code)` in Postgres + client-side check before finalizing |
| No validation of tree count before sync | Malformed payloads accepted by server | Server RPC validates: SubGroup must have at least 1 tree and no pending N/N trees before marking as sincronizada |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Sync button hidden in a menu or settings screen | Technicians forget to sync; data lost or stale | Sync CTA prominent on plantation detail screen; badge count of unsynced SubGroups always visible |
| Confirmation dialog on every tree registration | Registration too slow; technicians skip or rush | Zero confirmation on registration; provide undo of last tree only (one-tap decrement) |
| Species labels truncated to 2-3 characters | Wrong species registered; data quality failure | Use species abbreviation codes designed for the domain; show full name on long-press |
| No visual distinction between sincronizada/unsynced/activa states | Technician doesn't know what's safe | Color-coded SubGroup state chips: activa (yellow), finalizada (orange), sincronizada (green) |
| Error messages shown as technical strings | Technicians can't act on errors | All user-facing errors must be in plain Spanish with a clear next action ("Sin conexión. Volvé a intentar cuando tengas señal.") |
| App requires login on every session | Disruptive in the field; workers share devices | Persist session; only require login after explicit logout or token unrecoverable expiry |
| Dark mode not tested in outdoor sunlight | Text unreadable in glare | Test both themes at maximum brightness outdoors; prefer high-contrast light theme as default |

---

## "Looks Done But Isn't" Checklist

- [ ] **Offline auth:** Verify app opens and shows plantation data in airplane mode after >1 hour of no connectivity.
- [ ] **Atomic SubGroup sync:** Kill the app mid-sync (force-close); verify server has no partial SubGroup and local state is still pending.
- [ ] **Idempotent sync retry:** Sync the same SubGroup twice (simulate retry); verify no duplicate trees appear in Supabase.
- [ ] **Schema migration:** Install v1 with data, upgrade to v2 with a schema change; verify all local data survives.
- [ ] **N/N photo offline:** Resolve an N/N tree in airplane mode; verify the photo loads from local storage, not the network.
- [ ] **Glove test:** Register 10 trees using thick winter gloves on a physical device; verify no accidental wrong-species taps.
- [ ] **SubGroup immutability:** Verify that a sincronizada SubGroup cannot be edited — the UI must not present edit controls on sincronizada records.
- [ ] **Sync status visibility:** Count the number of UI interactions required to see how many SubGroups are pending sync. Must be zero (always visible).
- [ ] **RLS enforcement:** Authenticate as Technician A and attempt to fetch Technician B's SubGroups via Supabase client; must return empty.
- [ ] **Large SubGroup performance:** Register 300 trees in a single SubGroup, finalize, sync; verify sync completes in <30 seconds on a mid-range Android device.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auth session evicted while offline | MEDIUM | Force user to re-authenticate when connectivity returns; local data survives, but sync requires valid session |
| Outbox/domain write split caused data loss | HIGH | Manual reconciliation between local SQLite export and server records; requires admin access and likely field re-survey |
| Partial SubGroup on server from non-atomic sync | MEDIUM | Admin deletes partial SubGroup from server via dashboard; technician re-syncs from app |
| Schema migration failure after app update | HIGH | Requires a hotfix release with rollback migration; if unsynced data was in a breaking column, may require data recovery script |
| N/N trees never resolved, SubGroup stuck | LOW | Admin creates an admin-override tool to mark N/N as resolved with a "campo: no identificado" species; requires server-side tooling |
| Wrong species registered (no undo after finalize) | MEDIUM | Admin-only correction endpoint on server; immutability principle means this must be an explicit admin action with audit log |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Auth session expiry offline | Phase 1: Foundation | Launch in airplane mode after 1hr; confirm no logout |
| Outbox not atomic with domain write | Phase 1: Foundation / Sync Architecture | Force-crash during write; confirm no data split |
| Non-atomic SubGroup sync on server | Phase 2: Sync Architecture | Kill connection mid-sync; confirm no partial data on server |
| Schema migrations | Phase 1: Foundation | Install v1, upgrade to v2, confirm data survives |
| Species grid field usability | Phase 2: Tree Registration UI | Glove test on physical device outdoors |
| Unsynced data loss visibility | Phase 2: SubGroup Management | Count taps to see unsynced count; must be 0 |
| N/N blocking sync at scale | Phase 2-3: Tree Registration + Sync | End-of-day simulation with 10+ N/N trees; confirm flow completion |
| RLS security | Phase 1-2: Backend Setup | Cross-user data access test with Supabase client |
| SQLite performance (no WAL, no transactions) | Phase 1: Foundation | Insert 300 trees; measure registration latency |
| Photo memory issues | Phase 2: Tree Registration UI | Register 50 trees with photos; profile memory on low-end Android |

---

## Sources

- [Expo SQLite complete guide (Medium)](https://medium.com/@aargon007/expo-sqlite-a-complete-guide-for-offline-first-react-native-apps-984fd50e3adb)
- [React Native offline sync with SQLite queue (DEV Community)](https://dev.to/sathish_daggula/react-native-offline-sync-with-sqlite-queue-4975)
- [How to Build Offline-First SQLite Sync in Expo (DEV Community)](https://dev.to/sathish_daggula/how-to-build-offline-first-sqlite-sync-in-expo-1lli)
- [Offline-First Apps Made Simple: Supabase + PowerSync](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync)
- [Token refresh fails silently when offline — supabase/auth-js Issue #226](https://github.com/supabase/auth-js/issues/226)
- [Supabase Auth session lost when starting app offline — Supabase Discussion #36906](https://github.com/orgs/supabase/discussions/36906)
- [How to handle Supabase Auth in offline-first React Native](https://www.answeroverflow.com/m/1402284237478166549)
- [Offline-first React Native Apps with Expo, WatermelonDB, and Supabase](https://supabase.com/blog/react-native-offline-first-watermelon-db)
- [Drizzle ORM — Expo SQLite](https://orm.drizzle.team/docs/connect-expo-sqlite)
- [Building an Offline-First Production-Ready Expo App with Drizzle ORM and SQLite (Medium)](https://medium.com/@detl/building-an-offline-first-production-ready-expo-app-with-drizzle-orm-and-sqlite-f156968547a2)
- [SQLite WAL mode — official docs](https://sqlite.org/wal.html)
- [SQLite commits durability concerns (2025)](https://avi.im/blag/2025/sqlite-fsync/)
- [React Native Database Performance Comparison — PowerSync](https://www.powersync.com/blog/react-native-database-performance-comparison)
- [Handling large files in Expo with expo-file-system (Stackademic)](https://blog.stackademic.com/handling-large-files-in-expo-with-expo-file-system-3c2dffe59921)
- [expo/expo Issue #26781 — RAM crash with many images](https://github.com/expo/expo/issues/26781)
- [Row Level Security — Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Implementing the Outbox Pattern (Milan Jovanovic)](https://www.milanjovanovic.tech/blog/implementing-the-outbox-pattern)
- [Offline + Sync Architecture for Field Operations (Alpha Software)](https://www.alphasoftware.com/blog/offline-sync-architecture-tutorial-examples-tools-for-field-operations)
- [Build an offline-first app — Android Developers](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [TreeMapper by Plant-for-the-Planet](https://www.plant-for-the-planet.org/treemapper/) (reference for forestry app patterns)

---
*Pitfalls research for: offline-first plantation monitoring mobile app (React Native + SQLite + Supabase)*
*Researched: 2026-03-16*
