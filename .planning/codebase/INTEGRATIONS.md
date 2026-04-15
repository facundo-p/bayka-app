# External Integrations

**Analysis Date:** 2026-04-12

## APIs & External Services

**Supabase (Primary Backend):**
- **Auth**: Email/password authentication (built-in Supabase Auth)
  - SDK: `@supabase/supabase-js` 2.99.2
  - Auth env var: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Client: `mobile/src/supabase/client.ts` (async storage with refresh disabled)
  - Auth utilities: `mobile/src/supabase/auth.ts` (SecureStore token persistence)
  - Service: Supabase Auth with email confirmation bypass on seed

- **Database**: PostgreSQL via Supabase
  - Tables: organizations, profiles, plantations, subgroups, trees, species, plantation_users, plantation_species
  - RLS (Row-Level Security) policies enforce org/user isolation
  - Seed script: `supabase/seed.ts` (creates test org and users via service role)

- **Storage**: `tree-photos` bucket for plantation tree photos
  - Signed URLs generated server-side (3600s expiry)
  - Policies: Authenticated users can upload/read/overwrite
  - Storage path pattern: `plantations/{plantationId}/trees/{treeId}.jpg`
  - Implementation: `mobile/src/services/SyncService.ts` (uploadPhotoToStorage, downloadPhotosForPlantation)

## Data Storage

**Databases:**
- **Supabase (PostgreSQL)**
  - Connection: `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Client: `@supabase/supabase-js` via `mobile/src/supabase/client.ts`
  - Key tables:
    - `organizations` - Org metadata
    - `profiles` - User profiles with role (admin/tecnico)
    - `plantations` - Tree plantations with sync flags (`pendingSync`, `pendingEdit`)
    - `subgroups` - Plantation subdivisions (linea type)
    - `trees` - Individual trees with photo references
    - `species` - Species catalog (synced from server on app launch)
    - `plantation_users` - Plantation role assignments
    - `plantation_species` - Species visibility per plantation

- **SQLite (Local)**
  - File: `bayka.db` (Expo SQLite)
  - ORM: Drizzle ORM
  - Auto-sync: No - manual sync via SyncService
  - Offline mode: Full local reads/writes, deferred uploads
  - Migrations: 9 total (drizzle migrations in `mobile/drizzle/` + schema in `mobile/src/database/schema.ts`)

**File Storage:**
- **Local Device Storage** (primary)
  - Photo cache: `Paths.document/photos/` via `expo-file-system`
  - Max dimension: 1600px (resized by PhotoService)
  - Format: JPEG at 85% quality
  - Local URIs: `file://...` (preserved during offline sync)

- **Supabase Storage** (remote photos)
  - Bucket: `tree-photos` (not public)
  - Sync: Asynchronous, after local sync completes
  - Storage path: `plantations/{id}/trees/{id}.jpg`
  - Download: Signed URLs via `supabase.storage.from('tree-photos').createSignedUrl(...)`

**Caching:**
- AsyncStorage (`@react-native-async-storage/async-storage`) for non-sensitive cache (e.g., catalog state)
- SecureStore (`expo-secure-store`) for sensitive data:
  - `supabase_access_token` (Supabase auth token)
  - `supabase_refresh_token` (Supabase refresh token)
  - `user_role` (cached user role)
  - `last_email` (pre-fill login form)
  - Offline credentials (hashed passwords for 30-day offline TTL)

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth** (email/password)
  - Online mode: Email + password to `supabase.auth.signInWithPassword()`
  - Offline mode: PBKDF2-like offline credential cache via `OfflineAuthService.ts`
  - Token storage: SecureStore (2048-byte limit via 3 separate keys)
  - Session persistence: AsyncStorage (auto-refresh disabled)
  - Credential expiry: 30 days offline TTL (if `OFFLINE_LOGIN_EXPIRE=true` in config)

- **Offline Auth Implementation** (`mobile/src/services/OfflineAuthService.ts`)
  - Hash algorithm: SHA256 + random salt (via `expo-crypto`)
  - Cached credentials stored in SecureStore (encrypted by OS Keychain)
  - Quick login via cached password (1-tap after credentials saved)
  - Last online login timestamp tracked (TTL enforcement)

- **Custom Profiles**
  - Role-based: `admin` or `tecnico`
  - Per-org: `profiles.organizacion_id`
  - RLS enforced: Each user sees only their org's data

## Monitoring & Observability

**Error Tracking:**
- Not configured - errors logged to console

**Logs:**
- Console logging via `console.error()`, `console.log()` with prefixes:
  - `[Supabase]` - Supabase client setup
  - `[Sync]` - Sync service operations
  - Full stack traces for unrecognized errors

## CI/CD & Deployment

**Hosting:**
- EAS (Expo Application Services) for managed builds
- Local builds via `eas build --local` only (no remote builds)
- OTA updates: `expo-updates` with EAS Update backend (configured in `app.config.js`)

**CI Pipeline:**
- GitHub Actions workflows in `.github/workflows/`:
  - `ci.yml` - Lint + test on PR/push
  - `e2e.yml` - E2E tests (requires Supabase secrets in GitHub repo)
  - `supabase-backup.yml` - Backup trigger (manual)

**Git Integration:**
- Feature branches for phase execution
- Commits tracked in `.planning/config.json`
- PRs require approval before merge to main

## Environment Configuration

**Required env vars (root `.env`):**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key for seed script (root only, never in `mobile/`)
- `EAS_PROJECT_ID` - Expo project ID

**Build-time Secrets:**
- `eas.json` env block (empty currently, uses root `.env`)
- Local builds read from root `.env` via `app.config.js`

**Secrets Location:**
- Root `.env` (git-ignored via `.gitignore`)
- Example template: `.env.example`
- SecureStore for runtime tokens (encrypted by OS)

## Webhooks & Callbacks

**Incoming:**
- None configured - app is pull-based (polls Supabase on sync)

**Outgoing:**
- Photo uploads to Supabase Storage (batch, on user action)
- Subgroup/tree uploads to Supabase DB (batch, on user action)
- Export share: Native share sheet via `expo-sharing` (CSV/Excel)

## Data Sync Strategy

**Model: Offline-First with Deferred Upload**

1. **Local State** (SQLite):
   - `pendingSync` - Plantation created offline, needs upload
   - `pendingEdit` - Tree/subgroup edited offline, needs sync
   - `fotoSynced` - Photo has been uploaded to storage

2. **Pull Flow** (`SyncService.pullFromServer`):
   - Fetches species catalog (non-blocking)
   - Downloads plantation metadata, subgroups, trees
   - Downloads remote photos (signed URL → local cache)
   - Marks trees with remote photos as `fotoSynced=true`

3. **Upload Flow** (`SyncService.uploadOfflinePlantations` + `uploadPendingPhotos`):
   - Uploads locally-created plantations
   - Uploads plantation_species associations
   - Uploads individual tree photos to storage
   - Syncs subgroups with server
   - Marks `pendingSync=false` on success

4. **Photo Sync** (Per D-15):
   - Upload tree photos AFTER subgroup sync completes
   - Stores relative storage path `plantations/{id}/trees/{id}.jpg`
   - Downloads photos during pull (skips local file:// URIs)

5. **Network State**:
   - Detected via `@react-native-community/netinfo`
   - Queued operations silently retry when online

## Export & Reporting

**CSV Export** (`ExportService.exportToCSV`):
- Generates RFC 4180-compliant CSV
- Columns: ID Global, ID Parcial, Zona, SubGrupo, SubID, Periodo, Especie
- Shares via native sheet (app-dependent action)

**Excel Export** (`ExportService.exportToExcel`):
- SheetJS (xlsx 0.18.5) with base64 encoding for React Native
- Single sheet: "Plantacion"
- Same columns as CSV
- Shares via native sheet

---

*Integration audit: 2026-04-12*
