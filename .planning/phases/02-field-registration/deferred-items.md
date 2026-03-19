# Deferred Items

## Pre-existing Test Failure (out of scope for Plan 02-04)

**File:** mobile/tests/auth/logout.test.ts
**Issue:** Test expects `last_email` key to be deleted by `clearSession()`, but the auth implementation does not delete this key.
**Origin:** Pre-existing before Plan 02-04 started (confirmed by git history).
**Fix needed:** Either add `last_email` deletion to `clearSession()` in `src/supabase/auth.ts`, or remove the expectation from the test if `last_email` is no longer used.
