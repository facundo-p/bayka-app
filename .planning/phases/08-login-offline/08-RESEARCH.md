# Phase 8: Login Offline - Research

**Researched:** 2026-04-05
**Domain:** React Native offline auth, SecureStore credential caching, expo-crypto hashing
**Confidence:** HIGH

---

## Summary

Phase 8 adds offline login by caching a per-user credential record in SecureStore after a successful Supabase online login. When the device is offline, `signIn()` validates the submitted password against the cached hash instead of calling Supabase. The app already stores Supabase session tokens offline-safely and restores them without network. What is missing is the ability to **authenticate anew** (enter email + password) when both the device is offline AND no valid Supabase session token exists in AsyncStorage.

The critical finding is that **the login screen already stores plaintext passwords** in `SecureStore` under the key `saved_accounts` (an array of `{email, password}` objects). Phase 8 must replace this with a hash-based credential cache, keeping the UX (saved account chips, auto-login on tap) but eliminating plaintext password storage.

**`expo-crypto` is already installed** (`expo-crypto ~15.0.8`) and provides `digestStringAsync(SHA256, ...)` — no new dependencies are required for salted-hash credential storage.

**Primary recommendation:** Implement an `OfflineAuthService` in `src/services/OfflineAuthService.ts` that manages salted SHA-256 hashes in SecureStore. Rewrite the `saved_accounts` storage format from `{email, password}` to `{email, hash, salt, role}`. Wire it into `useAuth.signIn` and `useAuth.signOut`. The login screen UI flow stays unchanged.

---

## Project Constraints (from CLAUDE.md)

- All colors/styles from `src/theme.ts` — no hardcoded values in screens/components.
- Zero code duplication between admin/tecnico. Shared screens parametrized by role.
- Data access (db queries) only in `src/repositories/`, `src/queries/`, `src/services/`. Never in screens or hooks directly.
- Auth logic belongs in `src/services/` or `src/supabase/`. Hooks call service functions; they do not implement auth logic.
- Functions > 20 lines should be refactored.
- Update `.md` docs that become stale after changes.

---

## Current Auth Implementation — Audit

### What exists today

| File | Responsibility |
|------|---------------|
| `src/supabase/auth.ts` | `persistSession`, `clearSession`, `restoreSession` — token lifecycle in SecureStore |
| `src/supabase/client.ts` | Supabase client with `AsyncStorage` + `autoRefreshToken: true` |
| `src/hooks/useAuth.ts` | `session`, `role`, `loading` state; `signIn` (online-only), `signOut` |
| `app/(auth)/login.tsx` | Login form + saved accounts UX; stores `{email, password}` in `saved_accounts` SecureStore key |

### SecureStore keys currently in use

| Key | Value stored | Cleared on logout? |
|-----|-------------|-------------------|
| `supabase_access_token` | JWT access token | Yes |
| `supabase_refresh_token` | JWT refresh token | Yes |
| `user_role` | `'admin'` or `'tecnico'` | Yes |
| `last_email` | Last used email | No (intentional — pre-fills login) |
| `saved_accounts` | `JSON.stringify([{email, password}])` | No (bug — plaintext passwords persist across logout) |

### Critical finding: plaintext passwords already stored

`login.tsx` lines 22-29: `saveAccount(email, password)` writes `{email, password}` to `saved_accounts`. This is a security issue that Phase 8 will fix while implementing the offline auth feature.

### What `restoreSession` already handles offline

`restoreSession` in `src/supabase/auth.ts` already skips `supabase.auth.setSession` when offline and returns raw cached tokens. This means **app restart while offline with a valid prior session works today**. Phase 8 only needs to handle the case where there is no session (user was logged out or never logged in on this device) and connectivity is absent.

### `useAuth.signIn` today

```typescript
async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}
```

This always calls Supabase (network required). Phase 8 changes this to: check connectivity → if online use Supabase → if offline use credential cache.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-secure-store` | ~15.0.8 | Encrypted key-value storage (OS keychain/keystore) | Hardware-backed encryption; project already uses it |
| `expo-crypto` | ~15.0.8 | `digestStringAsync(SHA256, ...)` for password hashing | Already installed; no new dep; native crypto |
| `@react-native-community/netinfo` | 11.4.1 | Connectivity detection | Already used in `restoreSession` |

### No new dependencies needed

All required crypto and storage primitives are already installed. This phase is pure logic/service layer work.

---

## Architecture Patterns

### Recommended File Changes

```
mobile/src/
├── services/
│   └── OfflineAuthService.ts     ← NEW: hash/verify/store/clear credential cache
├── supabase/
│   └── auth.ts                   ← MODIFY: add clearOfflineCredentials to clearSession
├── hooks/
│   └── useAuth.ts                ← MODIFY: signIn uses connectivity-aware flow
└── app/(auth)/
    └── login.tsx                 ← MODIFY: replace saveAccount with OfflineAuthService
```

### Pattern 1: OfflineAuthService

**What:** Service that manages per-user credential cache (hashed password + salt + role) in SecureStore.
**When to use:** Called by `useAuth.signIn` on successful online login (cache), and on offline login attempt (verify).

```typescript
// src/services/OfflineAuthService.ts
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Key stores an array: [{email, hash, salt, role}]
const OFFLINE_CREDENTIALS_KEY = 'offline_credentials';

type OfflineCredential = {
  email: string;
  hash: string;   // SHA-256(password + salt)
  salt: string;   // 32-byte random hex string
  role: string;   // cached role for navigation
};

async function getAll(): Promise<OfflineCredential[]> {
  const raw = await SecureStore.getItemAsync(OFFLINE_CREDENTIALS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function cacheCredential(email: string, password: string, role: string): Promise<void> {
  const saltBytes = Crypto.getRandomBytes(32);
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + salt
  );
  const all = await getAll();
  const idx = all.findIndex(c => c.email === email);
  const entry: OfflineCredential = { email, hash, salt, role };
  if (idx >= 0) { all[idx] = entry; } else { all.push(entry); }
  await SecureStore.setItemAsync(OFFLINE_CREDENTIALS_KEY, JSON.stringify(all));
}

export async function verifyCredential(email: string, password: string): Promise<string | null> {
  const all = await getAll();
  const entry = all.find(c => c.email === email);
  if (!entry) return null;
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password + entry.salt
  );
  return hash === entry.hash ? entry.role : null;
}

export async function clearCredential(email: string): Promise<void> {
  const all = await getAll();
  const filtered = all.filter(c => c.email !== email);
  await SecureStore.setItemAsync(OFFLINE_CREDENTIALS_KEY, JSON.stringify(filtered));
}

export async function getCachedEmails(): Promise<string[]> {
  const all = await getAll();
  return all.map(c => c.email);
}
```

### Pattern 2: Connectivity-aware signIn in useAuth

```typescript
async function signIn(email: string, password: string) {
  const net = await NetInfo.fetch();
  const isOnline = net.isConnected === true && net.isInternetReachable !== false;

  if (!isOnline) {
    // Offline path: verify against cached credential
    const cachedRole = await verifyCredential(email, password);
    if (!cachedRole) {
      return { error: { message: 'Sin conexión. Iniciá sesión online primero.' } };
    }
    // Build a synthetic "offline session" — only role matters for navigation
    // The Supabase session tokens are still in AsyncStorage from prior login
    // We restore the session to get a valid supabase session object
    const restoredSession = await restoreSession();
    if (restoredSession) {
      setSession(restoredSession);
      setRole(cachedRole as Role);
      return { error: null };
    }
    // No prior session tokens either — offline auth is not possible
    return { error: { message: 'Sin conexión y sin sesión previa. Iniciá sesión online primero.' } };
  }

  // Online path: use Supabase, then cache credential on success
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (!result.error && result.data.session) {
    const role = /* fetch from profiles */;
    await cacheCredential(email, password, role);
  }
  return result;
}
```

**Note on session tokens during offline auth:** When a user logs in offline using cached credentials, the Supabase tokens already in AsyncStorage (from the prior online session) are reused. `restoreSession` returns them without network call. This means Supabase-dependent operations (RPCs, queries) will fail if the JWT is expired — but the app's offline-first design means all data operations work on local SQLite anyway. Token expiry is handled on next online session restore.

### Pattern 3: signOut clears specific user credential

On logout, only the current user's credential is cleared (other cached users remain available):

```typescript
async function signOut() {
  const currentEmail = await SecureStore.getItemAsync(EMAIL_KEY);
  try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
  await clearSession(); // clears tokens, role, keeps EMAIL_KEY
  if (currentEmail) await clearCredential(currentEmail);
  setSession(null);
  setRole(null);
}
```

### Pattern 4: Login screen — replace plaintext saveAccount

The `saved_accounts` key in login.tsx must be removed. The login screen account chips should read from `getCachedEmails()` instead. The `saveAccount(email, password)` call in `handleLogin` is replaced by `cacheCredential(...)` inside `useAuth.signIn` (not in the UI layer — keeps data access out of screens per CLAUDE.md rule 9).

The login screen only needs to know which emails have cached credentials (for showing the chips). It does not need passwords — chips trigger full `signIn(email, password)` with the user-entered password, or for auto-login, the stored password must NOT be in the UI layer.

**Decision required:** Should saved account chips still auto-login (requiring password storage somewhere), or should they only pre-fill the email field?

- Option A (current UX): Tap chip → auto-login (requires storing password or plaintext somewhere accessible to UI)
- Option B (security-first): Tap chip → pre-fill email only, user still types password

**Recommendation:** Option B. Storing a password (even hashed) for retrieval by the UI layer contradicts the purpose of hashing. The chip pre-fills the email; the user enters the password; `signIn` verifies offline. The UX cost is minor (one password entry). This also matches the `rememberAccount` toggle semantics better.

### Anti-Patterns to Avoid

- **Storing plaintext passwords in SecureStore:** The current `saved_accounts` format does this. Must be replaced. Never store a password that can be retrieved and compared directly.
- **Putting auth logic in the login screen:** `login.tsx` should call `signIn` — not call `OfflineAuthService` directly. Keeps service layer clean.
- **Global credential clear on logout:** Clearing ALL cached credentials when one user logs out would break multi-user. Clear only the current user's entry.
- **Using SHA-256 without salt:** Without salt, identical passwords hash identically, enabling precomputed lookups. Always generate a per-user random salt.
- **Calling `supabase.auth.signInWithPassword` when offline:** Supabase JS client will throw a network error. Check connectivity first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random salt generation | Custom entropy source | `Crypto.getRandomBytes(32)` | Native CSPRNG, already installed |
| Password hashing | Custom hash function | `Crypto.digestStringAsync(SHA256, pw+salt)` | Platform-native, tested |
| Encrypted storage | Custom encryption layer | `expo-secure-store` | Hardware keychain/keystore backed |
| Connectivity check | Custom socket probe | `NetInfo.fetch()` | Already used in `restoreSession` |

**Key insight:** SHA-256 with a random salt is sufficient for this use case. The primary threat model is physical device access — expo-secure-store provides hardware-backed encryption at rest, and SHA-256+salt prevents rainbow table attacks. bcrypt/argon2 are not available as native Expo modules; they require Node.js and would need custom native modules. SHA-256+salt in SecureStore is the appropriate solution for this platform.

---

## Common Pitfalls

### Pitfall 1: Offline sign-in returns a role but no valid Supabase session
**What goes wrong:** `verifyCredential` succeeds (correct password), but there are no tokens in AsyncStorage (user cleared app data, or first install). The app sets `role` but `session` is null — screens that call `supabase.auth.getUser()` fail.
**Why it happens:** Offline auth decouples credential verification from Supabase session possession.
**How to avoid:** After `verifyCredential` succeeds, call `restoreSession()`. If it returns null, the user has no prior Supabase session — offline login cannot proceed. Show: "Sin conexión y sin sesión previa. Necesitás conectarte al menos una vez."
**Warning signs:** `session` is set but `supabase.auth.getUser()` returns an error.

### Pitfall 2: `supabase.auth.signOut()` throws when offline
**What goes wrong:** `signOut` calls `supabase.auth.signOut()`, which tries a network request and throws when offline.
**Why it happens:** Supabase client sends a logout request to invalidate the server-side session.
**How to avoid:** `useAuth.signOut` already wraps in `try/catch` and always clears locally regardless. No change needed — but verify this covers offline case.

### Pitfall 3: Clearing the wrong credentials on logout
**What goes wrong:** All cached credentials wiped on logout — other users' saved sessions disappear.
**Why it happens:** Using a blanket `SecureStore.deleteItemAsync(OFFLINE_CREDENTIALS_KEY)` on logout.
**How to avoid:** Filter by email — remove only the current user from the array, then write back.

### Pitfall 4: Token expiry after long offline period
**What goes wrong:** User was offline for > access token TTL (typically 1 hour for Supabase). `restoreSession` returns the old tokens. When connectivity returns, `supabase.auth.setSession` is called and may fail if refresh token is also expired (default: 7 days).
**Why it happens:** `restoreSession` skips network validation when offline (by design, per Pitfall 1 from Phase 1 decisions).
**How to avoid:** On next app launch with connectivity, `restoreSession` calls `supabase.auth.setSession` which refreshes tokens automatically. If the refresh token is expired (> 7 days offline), the user is forced to re-login. This is expected and acceptable behavior.

### Pitfall 5: `saved_accounts` key not migrated
**What goes wrong:** Old `saved_accounts` entries (plaintext passwords) remain in SecureStore after upgrading to Phase 8.
**Why it happens:** Existing install — Phase 8 code adds the new key but doesn't remove the old one.
**How to avoid:** On first run of Phase 8, delete `saved_accounts` key during app init or first `OfflineAuthService` operation.
**Warning signs:** Two credential stores coexist; plaintext passwords still readable.

### Pitfall 6: expo-crypto `digestStringAsync` mock in Jest
**What goes wrong:** Tests call `digestStringAsync` but `expo-crypto` is mocked with only `randomUUID` in `tests/setup.ts`.
**Why it happens:** Current mock: `jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(...) }))`.
**How to avoid:** Extend the mock in `tests/setup.ts` to include `digestStringAsync` and `getRandomBytes`:
```javascript
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substring(2, 10)),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_alg, data) => `mock-hash-${data}`),
  getRandomBytes: jest.fn((n) => new Uint8Array(n).fill(42)),
}));
```

---

## Code Examples

### Verified: expo-crypto digestStringAsync (from installed package source)

```typescript
// Source: mobile/node_modules/expo-crypto/build/Crypto.d.ts
import * as Crypto from 'expo-crypto';

const salt = Array.from(Crypto.getRandomBytes(32))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('');

const hash = await Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  password + salt
);
```

### Verified: NetInfo pattern (from existing useNetStatus hook)

```typescript
// Source: mobile/src/hooks/useNetStatus.ts pattern (Phase 05)
const net = await NetInfo.fetch();
const isOnline = net.isConnected === true && net.isInternetReachable !== false;
// Note: treat null isInternetReachable as reachable (Android decision from Phase 05)
```

### Verified: Multi-user SecureStore array pattern (already in login.tsx)

```typescript
// Source: mobile/app/(auth)/login.tsx (existing pattern to replicate)
const raw = await SecureStore.getItemAsync(SOME_KEY);
const list = raw ? JSON.parse(raw) : [];
const idx = list.findIndex(item => item.email === email);
if (idx >= 0) { list[idx] = updated; } else { list.push(updated); }
await SecureStore.setItemAsync(SOME_KEY, JSON.stringify(list));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plaintext `{email, password}` in `saved_accounts` | Salted SHA-256 hash in `offline_credentials` | Phase 8 | Eliminates plaintext password storage |
| UI layer manages credential save (login.tsx) | Service layer manages all credential logic (OfflineAuthService) | Phase 8 | Aligns with CLAUDE.md rule: no data logic in screens |
| `signIn` is online-only | `signIn` is connectivity-aware | Phase 8 | Enables offline login with cached credentials |

---

## Open Questions

1. **Auto-login chip behavior (passwords)**
   - What we know: Current chips store plaintext passwords and auto-login when tapped
   - What's unclear: Should Phase 8 preserve auto-login (would require storing something retrievable) or downgrade to email pre-fill only?
   - Recommendation: Downgrade to email pre-fill (Option B). Rationale: the hash is one-way — there's no safe way to auto-login without the user providing the password. This is the security-correct behavior.

2. **Migration of existing `saved_accounts` data**
   - What we know: Any existing install has plaintext passwords in `saved_accounts`
   - What's unclear: Should migration be in an initializer, or lazy (on first OfflineAuthService call)?
   - Recommendation: Lazy cleanup — delete `saved_accounts` on the first call to `cacheCredential` or `getCachedEmails`. Doesn't require a separate migration step.

3. **What to show on LoginScreen when offline with no cached credential for that email**
   - What we know: User enters email that has no cached entry
   - Recommendation: Show "Sin conexión. Iniciá sesión online primero para habilitar el acceso sin internet." — clear Spanish message.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all required libraries already installed, no new CLI tools or services needed).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 + jest-expo |
| Config file | `mobile/jest.config.js` |
| Quick run command | `cd mobile && npx jest tests/auth/ --testEnvironment node` |
| Full suite command | `cd mobile && npx jest --testEnvironment node` |

### Phase Requirements → Test Map

| ID | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| OFFL-01 | First login requires internet — online path calls Supabase | unit | `npx jest tests/auth/offlineAuth.test.ts -t "online path"` | Wave 0 |
| OFFL-02 | Successful online login caches salted hash in SecureStore | unit | `npx jest tests/auth/offlineAuth.test.ts -t "caches credential"` | Wave 0 |
| OFFL-03 | Subsequent offline login verifies against cached hash | unit | `npx jest tests/auth/offlineAuth.test.ts -t "offline verify"` | Wave 0 |
| OFFL-04 | Wrong password offline returns error (not crash) | unit | `npx jest tests/auth/offlineAuth.test.ts -t "wrong password"` | Wave 0 |
| OFFL-05 | Logout clears only current user credential, others remain | unit | `npx jest tests/auth/offlineAuth.test.ts -t "multi-user"` | Wave 0 |
| OFFL-06 | Offline login with no prior session tokens fails gracefully | unit | `npx jest tests/auth/offlineAuth.test.ts -t "no session"` | Wave 0 |
| OFFL-07 | `saved_accounts` plaintext key is not written by Phase 8 code | unit | `npx jest tests/auth/offlineAuth.test.ts -t "no plaintext"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd mobile && npx jest tests/auth/ --testEnvironment node`
- **Per wave merge:** `cd mobile && npx jest --testEnvironment node`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/auth/offlineAuth.test.ts` — covers OFFL-01 through OFFL-07
- [ ] `tests/setup.ts` — extend expo-crypto mock with `digestStringAsync` and `getRandomBytes`

---

## Sources

### Primary (HIGH confidence)
- `mobile/src/supabase/auth.ts` — full implementation of session management
- `mobile/src/hooks/useAuth.ts` — full signIn/signOut/restoreSession orchestration
- `mobile/app/(auth)/login.tsx` — current credential storage (plaintext found)
- `mobile/node_modules/expo-crypto/build/Crypto.d.ts` — verified API surface for `digestStringAsync`, `getRandomBytes`, `CryptoDigestAlgorithm`
- `mobile/tests/setup.ts` — verified current expo-crypto mock (missing digestStringAsync)
- `mobile/package.json` — verified installed versions: expo-crypto ~15.0.8, expo-secure-store ~15.0.8

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 1 decisions: SecureStore key structure, restoreSession behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and confirmed in package.json
- Architecture: HIGH — based on direct code audit of existing auth files
- Pitfalls: HIGH — Pitfall 5 (plaintext migration) confirmed by direct reading of login.tsx; others derived from existing code patterns
- Security approach: HIGH — SHA-256+salt is verified as available in expo-crypto; approach is appropriate for the threat model

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable libraries)
