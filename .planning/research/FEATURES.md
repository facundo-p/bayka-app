# Feature Research

**Domain:** Offline-first field data collection — ecological restoration plantation monitoring
**Researched:** 2026-03-16
**Confidence:** HIGH (verified against multiple reference apps: KoBoToolbox, ODK Collect, TreeMapper, iNaturalist, TREEO)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features technicians and admins assume exist. Missing these = product feels broken or untrustworthy in field conditions.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Offline-first data entry | Field sites have no connectivity; any app that requires internet is DOA | HIGH | SQLite local store; all writes local, sync on demand |
| One-tap species registration | Speed is the dominant UX constraint; walking users, gloved hands, sunlight | MEDIUM | Button grid, no confirmation dialogs, instant feedback |
| Clear sync state visibility | Data loss is catastrophic; users must always know what's pending | LOW | Color-coded state indicators (recording / finished / synced) on every list item |
| Persistent session / auth | Field users don't re-login mid-task; session must survive app close | LOW | Supabase JWT stored in secure device storage |
| Role separation (admin / field) | Admins configure, field workers register; mixing roles creates confusion | MEDIUM | Simple role check on login; different navigation roots |
| Photo capture from camera | Unidentified trees require photo evidence; standard in every field tool | LOW | React Native Camera / Expo Camera; local storage only |
| Manual sync initiation | Users must control when data leaves the device; auto-sync surprises fail | LOW | Explicit sync button; confirm before sending |
| Sync conflict detection | Duplicate SubGroup codes must be caught server-side and surfaced clearly | MEDIUM | Server rejects duplicate code; error shown inline |
| Plantation-scoped species list | Technicians only see species relevant to their current site (typically ~20) | LOW | Admin configures per-plantation; downloaded on sync |
| Data export (CSV/Excel) | Downstream analysis in spreadsheets is the norm for ecological data teams | MEDIUM | Export on plantation finalization; columns fixed per spec |
| Dashboard with progress stats | Technicians and admins need to see how far along a plantation is | LOW | Tree count (total, unsynced, today) per plantation |
| Unidentified tree workflow (N/N) | Field reality: species sometimes can't be identified on the spot | MEDIUM | N/N button in grid; photo mandatory; must resolve before sync |
| SubGroup state machine | Clear lifecycle (recording → finished → synced) is required for data integrity | MEDIUM | State enforced both in local DB and on server |
| Immutability after sync | Synced data must be trusted as a stable record; edits after sync break audit trails | LOW | UI hides edit controls for synced records; server enforces |
| Error messages in plain language | Gloved users under time pressure cannot parse technical errors | LOW | "SubGroup code already exists" not "409 Conflict" |

---

### Differentiators (Competitive Advantage)

Features specific to Bayka's context that go beyond what generic tools like KoBoToolbox or ODK provide out of the box.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Species button grid (not a form) | Generic tools use forms; Bayka needs a physical-world analogy to walking a planting line — tapping buttons in sequence is faster and more natural than filling fields | MEDIUM | Fixed grid per plantation; species order is admin-configurable; buttons sized for gloves (min 48x48dp, prefer larger) |
| Sequential position tracking | Each tree gets an automatic position within the SubGroup; this becomes part of SubID and is essential for spatial correlation later | LOW | Incremented locally on each tap; displayed on screen |
| "Reverse order" for lines | When a technician walks a line in the wrong direction, reversing the order is a one-tap fix that recalculates positions — generic tools don't model this | LOW | Position recalculated in-place; only allowed before sync |
| N/N resolve-before-sync gate | Forces identification resolution while the technician still has visual access to the site; prevents unresolvable unknowns in the final dataset | LOW | Sync gate check at SubGroup finalization |
| SubGroup as atomic sync unit | Generic tools sync form-by-form; SubGroup-level atomicity prevents partial data reaching the server | MEDIUM | Transaction-wrapped sync; server rejects partial SubGroups |
| Seeded species codes (SubID) | SubID encodes SubGroup + Species + Position in a human-readable, reproducible way — enables QA without opening the app | LOW | Generated locally, deterministic, no UUID collision risk |
| Admin-controlled species button order | Admins who know the planting design can arrange buttons to match the species order in the ground, reducing cognitive load for technicians | LOW | Simple drag-reorder in admin UI |
| Today's tree count on dashboard | Technicians want to know how productive they've been each day; this simple stat is motivating and helps supervisors track pace | LOW | Filtered by created_at date in local query |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful but would undermine the app's core reliability and simplicity goals.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic background sync | "It would be convenient to sync without thinking about it" | In no-connectivity zones, auto-sync triggers fail silently; partial syncs corrupt SubGroup atomicity; surprises the user when data is consumed mid-task; battery drain | Explicit sync button with clear connectivity indicator and pending count |
| Edit synced records | "We made a mistake after syncing" | Synced data is the research record; allowing edits after sync requires version history, audit logs, and resolving divergence — all high complexity for rare events | Treat synced data as final; if correction needed, add a separate correction record |
| Real-time multi-user dashboard | "Supervisors want live tree counts" | Requires persistent websocket connection that fails in the field; adds server complexity; the app is offline-first by design | Sync-on-demand pull during manual sync; server dashboard can be separate web-only admin tool |
| GPS per-tree coordinates | "It would be great to know where each tree is" | In a planting line, trees are 1-2m apart; GPS accuracy is ±3-5m; the data would be meaningless; capturing GPS per tree would slow registration dramatically | Use SubGroup polygon or line GPS at the admin/GIS level instead; per-tree GPS is a Phase 2+ concern |
| In-app species management | "Admins want to add species on the fly" | Species codes are embedded in SubIDs; changing them mid-plantation corrupts existing records; species catalog needs controlled vocabulary | Seed via data load; admin can add species to a plantation's allowed list but not edit the global catalog |
| Photo upload to server during sync | "We want photos in the cloud" | A plantation with thousands of trees can have thousands of photos; field uploads over mobile data are expensive and slow; sync would time out | Photos stay local in Phase 1; export/upload via Wi-Fi as a separate batch operation in Phase 2 |
| Self-registration for users | "Let new technicians sign up themselves" | MVP has 4 users; self-registration adds email verification flows, admin approval queues, and onboarding complexity for no benefit at this scale | Seed users from admin panel; add self-registration only when scale requires it |
| Confirmation dialogs on every tree tap | "Prevent accidental registrations" | Every extra tap doubles registration time; technicians are walking a line at pace; false accidental taps are rare and easily undone within the SubGroup before finalization | Show last 3 registered trees on screen; allow delete of last entry without confirmation (undo-style) |
| Complex conflict resolution UI | "What if two technicians use the same SubGroup code?" | The conflict rate is very low; building a merge UI creates more complexity than it solves | Reject duplicate on sync with clear message; technician renames the local SubGroup and re-syncs |

---

## Feature Dependencies

```
[Auth / Session]
    └──required by──> [Dashboard]
                          └──required by──> [Plantation View]
                                                └──required by──> [SubGroup Management]
                                                                      └──required by──> [Tree Registration]
                                                                                            └──required by──> [N/N Workflow]

[Species Catalog (seeded)]
    └──required by──> [Plantation Species Config (Admin)]
                          └──required by──> [Species Button Grid]
                                                └──required by──> [Tree Registration]
                                                └──required by──> [N/N Resolution]

[Tree Registration]
    └──required by──> [SubGroup Finalization]
                          └──required by──> [Manual Sync]
                                                └──required by──> [Plantation Finalization (Admin)]
                                                                      └──required by──> [ID Generation]
                                                                                            └──required by──> [CSV/Excel Export]

[SubGroup Finalization]
    └──required by──> [Reverse Order] (only allowed pre-finalization)

[Manual Sync] ──enhances──> [Dashboard Stats] (pulls other technicians' data)

[N/N Workflow] ──gates──> [Manual Sync] (unresolved N/N blocks sync)

[Photo Capture] ──required by──> [N/N Workflow] (photo mandatory for N/N)
[Photo Capture] ──optional in──> [Tree Registration]
```

### Dependency Notes

- **Auth requires connectivity at first login:** Session token cached after first auth; subsequent app opens work offline with cached token. Supabase JWT refresh requires connectivity but short-lived failures are tolerable.
- **Species Catalog must be seeded before any plantation:** No species = no button grid = no registration. Must be part of app initialization / first sync.
- **SubGroup Finalization gates Sync:** The state machine prevents accidental submission of in-progress lines. Finalization is the explicit intent signal.
- **N/N Resolution gates Sync:** This is intentional — forces resolution while the technician has field access to the tree. Do not allow skipping.
- **ID Generation requires Plantation Finalization:** IDs are assigned globally after all SubGroups are synced; this is a one-time admin action and must not be reversible.
- **CSV Export requires ID Generation:** Export without IDs would produce incomplete records. Block export until finalization is complete.

---

## MVP Definition

### Launch With (v1)

Minimum required to validate in the Bayka autumn 2026 planting season.

- [ ] Auth (email/password, persistent session, role detection) — without this nothing works
- [ ] Dashboard with plantation list and basic stats — entry point for every user
- [ ] Admin: create plantation with lugar + periodo — data collection can't start without a plantation
- [ ] Admin: configure species per plantation (from seeded catalog) — defines the button grid
- [ ] Admin: assign technicians to plantation — access control
- [ ] Technician: create SubGroups with code — organizes the planting line data
- [ ] Species button grid (one-tap registration, instant feedback, no dialogs) — core value prop
- [ ] Last 3 trees display during registration — quick correction reference
- [ ] N/N registration with mandatory photo — field reality, must be handled
- [ ] N/N resolution screen — gate to sync; must exist before sync does
- [ ] Reverse order button — field reality, technicians walk lines both ways
- [ ] SubGroup finalization (recording → finished) — explicit intent gate
- [ ] Manual sync (SubGroup + trees as atomic unit) — reason the app exists
- [ ] Sync conflict detection and clear error message — data integrity guarantee
- [ ] Download updated data on sync — enables multi-technician coordination
- [ ] Admin: finalize plantation — unlocks ID generation
- [ ] Admin: generate plantation IDs and global org IDs — required for research dataset
- [ ] Admin: export to CSV/Excel — delivers the data to the research team
- [ ] Seeded users (2 admin, 2 tecnico) — MVP simplification, no self-registration needed

### Add After Validation (v1.x)

Features to add once the core registration flow is proven in the field.

- [ ] Photo optional attachment to identified trees — validated need; low risk to add post-launch
- [ ] Admin: add species to plantation after creation — operators requested this mid-season
- [ ] Admin: adjust species button order — reduces technician cognitive load
- [ ] Today's count breakdown per technician on dashboard — motivating; simple query addition
- [ ] Better sync error recovery UX — first version can be basic; improve from field feedback

### Future Consideration (v2+)

Features to defer until Phase 1 is validated and Phase 2 is scoped.

- [ ] GPS per SubGroup (polygon or line start/end) — spatial correlation for ecological analysis
- [ ] Photo upload to server — requires Wi-Fi batch upload strategy, storage cost planning
- [ ] Multiple organizations — schema supports it; UI does not need it yet
- [ ] GIS export (GeoJSON, Shapefile) — requested by ecological researchers; high value, requires GPS data first
- [ ] Follow-up monitoring (tree survival surveys) — major new workflow, not planting-phase
- [ ] AI-assisted species identification from photo — interesting but requires training data and connectivity
- [ ] Real-time admin dashboard (web) — separate web app concern, not mobile
- [ ] Self-registration for users — only relevant when organization grows beyond seed users

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Species button grid | HIGH | MEDIUM | P1 |
| Offline-first SQLite store | HIGH | HIGH | P1 |
| Auth + session persistence | HIGH | LOW | P1 |
| SubGroup management + state machine | HIGH | MEDIUM | P1 |
| Manual sync (atomic SubGroup) | HIGH | HIGH | P1 |
| N/N workflow (register + resolve) | HIGH | MEDIUM | P1 |
| Dashboard with stats | MEDIUM | LOW | P1 |
| Admin plantation creation + species config | HIGH | MEDIUM | P1 |
| Plantation finalization + ID generation | HIGH | MEDIUM | P1 |
| CSV/Excel export | HIGH | LOW | P1 |
| Reverse order button | MEDIUM | LOW | P1 |
| Sync conflict detection + error message | HIGH | LOW | P1 |
| Photo capture (N/N mandatory, optional elsewhere) | MEDIUM | LOW | P1 |
| Today's tree count | LOW | LOW | P2 |
| Admin: species button order config | LOW | LOW | P2 |
| Photo upload to server | MEDIUM | HIGH | P3 |
| GPS per tree | MEDIUM | MEDIUM | P3 |
| Multi-org UI | LOW | HIGH | P3 |
| GIS export | MEDIUM | HIGH | P3 |
| AI species identification | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for autumn 2026 launch
- P2: Should have — add when core is stable and before launch if time allows
- P3: Future phase — do not build until P1 is validated

---

## Competitor Feature Analysis

| Feature | KoBoToolbox / ODK Collect | TreeMapper (Plant-for-the-Planet) | iNaturalist | Bayka Approach |
|---------|--------------------------|-----------------------------------|-------------|----------------|
| Offline data entry | Yes — full offline form fill | Yes — offline with auto-sync | Partial — capture offline, sync later | Yes — full offline, manual sync |
| Species selection | Dropdown / search in form | 60,000+ species library, searchable | Species suggestion via AI | Button grid, plantation-scoped (~20 species), no search needed |
| Photo capture | Yes — optional or required per field | Yes — standardized photo required | Yes — photo drives ID | Yes — mandatory for N/N, optional otherwise |
| GPS capture | Yes — automatic on submit | Yes — required for each tree/polygon | Yes — automatic | Deferred to Phase 2 |
| Multi-user coordination | Server merge after separate submissions | Single user per device | Community ID | Sync + download; each technician owns their SubGroups |
| Sync model | Auto-sync on connectivity | Auto-sync when back online | Upload on demand | Manual, user-initiated only |
| Conflict resolution | Form-level deduplication | Not prominent | Not applicable | Duplicate SubGroup code rejection; manual resolution |
| Data export | CSV, Excel, KML, SPSS, JSON | GeoJSON | CSV, Darwin Core | CSV, Excel (Phase 1); GeoJSON deferred |
| Custom ID scheme | Configurable meta-fields | Auto-generated UUID | Auto-generated | SubID (SubGroup+Species+Position) + plantation-sequential ID + global org ID |
| Unidentified records | Free-text notes | Not modeled | Placeholder observation | N/N category, mandatory photo, resolve-before-sync gate |
| Field UX | Form-centric, scrollable | Standard mobile app | Standard mobile app | Button-grid primary interface, designed for gloved hands, max 2 taps per tree |
| Role separation | Project admin vs. data collector | Single role | Community roles | Admin (configure/export) vs. Tecnico (register/sync) |

---

## Sources

- [KoBoToolbox documentation — data collection tools](https://support.kobotoolbox.org/data-collection-tools.html)
- [ODK Collect documentation](https://docs.getodk.org/collect-intro/)
- [TreeMapper by Plant-for-the-Planet](https://www.plant-for-the-planet.org/treemapper/)
- [TreeMapper GitHub](https://github.com/Plant-for-the-Planet-org/treemapper)
- [iNaturalist — offline use discussion](https://forum.inaturalist.org/t/offline-use-of-inat-app-unable-to-add-to-projects/53842)
- [Review and assessment of smartphone apps for forest restoration monitoring — Restoration Ecology 2024](https://onlinelibrary.wiley.com/doi/10.1111/rec.14136)
- [WRI Restoration Monitoring Tools Guide](https://www.wri.org/initiatives/restoration-monitoring-tools-guide)
- [Alpha Software: 3 Best Mobile Field Data Collection Apps (Offline)](https://www.alphasoftware.com/blog/3-best-mobile-field-data-collection-apps-offline-free-options)
- [Dimagi: 3 Considerations for Offline Data Collection](https://www.dimagi.com/blog/mobile-data-collection-offline-considerations/)
- [Offline + Sync Architecture for Field Operations](https://www.alphasoftware.com/blog/offline-sync-architecture-tutorial-examples-tools-for-field-operations)
- Bayka internal: SPECS.md, domain-model.md, ui-ux-guidelines.md (project documentation)

---

*Feature research for: offline-first plantation monitoring mobile app (Bayka)*
*Researched: 2026-03-16*
