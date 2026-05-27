import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import path from 'path';

describe('Drizzle migrations bundle', () => {
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');

  it('runs all migrations including 0011 without errors', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);
    expect(() => {
      migrate(db, { migrationsFolder });
    }).not.toThrow();
    sqlite.close();
  });

  it('creates groups and parcelas tables and removes subgroups after 0011', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder });
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('groups');
    expect(names).toContain('parcelas');
    expect(names).not.toContain('subgroups');
    sqlite.close();
  });

  it('replaces trees.subgrupo_id with trees.group_id', () => {
    const sqlite = new Database(':memory:');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder });
    const cols = sqlite.prepare('PRAGMA table_info(trees)').all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain('group_id');
    expect(colNames).not.toContain('subgrupo_id');
    sqlite.close();
  });
});
