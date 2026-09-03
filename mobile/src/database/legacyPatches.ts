import { isDuplicateColumnError, isNoSuchTableError } from './sqliteErrors';
import { createTaggedLogger } from '../utils/taggedLogger';

const patchLog = createTaggedLogger('DB Patch');

/** Minimal sync surface these patches need — matches expo-sqlite's SQLiteDatabase, kept narrow for testability. */
export interface SqliteSyncHandle {
  execSync(source: string): void;
  getAllSync<T>(source: string): T[];
}

/** user_version target after the v4 one-time fix (see applyPendingSyncCounterFix). */
const PENDING_SYNC_COUNTER_FIX_VERSION = 4;

/**
 * Runs `ALTER TABLE ... ADD COLUMN`, tolerating the two expected outcomes: the column already
 * exists (a normal drizzle migration already added it), or the table doesn't exist yet (very
 * first launch, before useMigrations has run — drizzle will create the column itself). Any other
 * error (disk, syntax, corruption) is unexpected and escalates.
 */
function addColumnIfMissing(sqlite: SqliteSyncHandle, table: string, column: string, ddl: string): void {
  try {
    sqlite.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
  } catch (e) {
    if (isDuplicateColumnError(e) || isNoSuchTableError(e)) return;
    patchLog.error(`ALTER TABLE ${table} ADD COLUMN ${column} failed`, e);
    throw e;
  }
}

/**
 * groups.pending_sync (drizzle migration 0009) + one-time backfill marking already-finalized
 * groups as pending, since DEFAULT 0 leaves rows created before this column unmarked. Re-marking
 * is idempotent (the sync RPC upserts via ON CONFLICT DO UPDATE).
 */
function applyGroupsPendingSyncPatch(sqlite: SqliteSyncHandle): void {
  try {
    sqlite.execSync('ALTER TABLE groups ADD COLUMN pending_sync integer NOT NULL DEFAULT 0;');
    sqlite.execSync("UPDATE groups SET pending_sync = 1 WHERE estado = 'finalizada';");
  } catch (e) {
    if (isDuplicateColumnError(e) || isNoSuchTableError(e)) return;
    patchLog.error('groups.pending_sync patch failed', e);
    throw e;
  }
}

/**
 * v1-v3 tried to guess which groups needed sync but kept re-marking already-synced ones; v4
 * clears all flags instead — finalizeGroup()/markGroupSynced() handle the natural flow correctly
 * from here on. Runs once, tracked via PRAGMA user_version. Swallows only "no such table" (groups
 * not created yet on a fresh install); anything else escalates.
 */
function applyPendingSyncCounterFix(sqlite: SqliteSyncHandle): void {
  try {
    const [{ user_version }] = sqlite.getAllSync<{ user_version: number }>('PRAGMA user_version;');
    if (user_version < PENDING_SYNC_COUNTER_FIX_VERSION) {
      sqlite.execSync('UPDATE groups SET pending_sync = 0;');
      sqlite.execSync(`PRAGMA user_version = ${PENDING_SYNC_COUNTER_FIX_VERSION};`);
    }
  } catch (e) {
    if (isNoSuchTableError(e)) return;
    patchLog.error('pending_sync counter one-time fix failed', e);
    throw e;
  }
}

/**
 * Safety nets for columns that drizzle migrations 0008/0009/0010 add. drizzle-orm's sqlite
 * migrator only applies a migration if its journal `when` timestamp is greater than the single
 * highest `created_at` already recorded (sqlite-core/dialect.js, `SQLiteAsyncDialect.migrate`) —
 * it does NOT walk the journal in order. Migrations 0008-0010 were assigned a `when` lower than
 * migration 0007's, so any device that had already applied through 0007 permanently skips them
 * (reproduced in tests/database/legacyPatches.test.ts). These ALTERs re-apply the same columns
 * idempotently so those devices still end up with the schema drizzle intended.
 */
export function applyLegacySqlitePatches(sqlite: SqliteSyncHandle): void {
  addColumnIfMissing(sqlite, 'trees', 'foto_synced', 'integer NOT NULL DEFAULT 0');
  applyGroupsPendingSyncPatch(sqlite);
  applyPendingSyncCounterFix(sqlite);
  addColumnIfMissing(sqlite, 'trees', 'conflict_especie_id', 'text');
  addColumnIfMissing(sqlite, 'trees', 'conflict_especie_nombre', 'text');
}
