/**
 * Issue #69 — la migración 0014 renombra el tipo de grupo legacy 'parcela' a
 * 'bosquete' (el server ya removió 'parcela' del CHECK en mig 012). Verifica que
 * el UPDATE transforma las filas legacy y las marca pending_sync para re-push.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, '../../drizzle/0014_groups_tipo_parcela_to_bosquete.sql'),
  'utf8',
);

function seedDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(`CREATE TABLE groups (
    id text PRIMARY KEY NOT NULL,
    tipo text NOT NULL DEFAULT 'linea',
    pending_sync integer NOT NULL DEFAULT 0
  );`);
  return sqlite;
}

describe('0014 groups tipo parcela -> bosquete', () => {
  it('renombra filas legacy tipo=parcela a bosquete y las marca pending_sync', () => {
    const sqlite = seedDb();
    sqlite.prepare("INSERT INTO groups (id, tipo, pending_sync) VALUES ('g1', 'parcela', 0)").run();
    sqlite.prepare("INSERT INTO groups (id, tipo, pending_sync) VALUES ('g2', 'linea', 0)").run();

    sqlite.exec(MIGRATION_SQL);

    const g1 = sqlite.prepare('SELECT tipo, pending_sync FROM groups WHERE id = ?').get('g1') as { tipo: string; pending_sync: number };
    const g2 = sqlite.prepare('SELECT tipo, pending_sync FROM groups WHERE id = ?').get('g2') as { tipo: string; pending_sync: number };

    expect(g1.tipo).toBe('bosquete');
    expect(g1.pending_sync).toBe(1);
    // las filas 'linea' no se tocan
    expect(g2.tipo).toBe('linea');
    expect(g2.pending_sync).toBe(0);

    sqlite.close();
  });

  it('no deja ninguna fila con tipo=parcela', () => {
    const sqlite = seedDb();
    sqlite.prepare("INSERT INTO groups (id, tipo) VALUES ('a', 'parcela')").run();
    sqlite.prepare("INSERT INTO groups (id, tipo) VALUES ('b', 'parcela')").run();

    sqlite.exec(MIGRATION_SQL);

    const count = sqlite.prepare("SELECT COUNT(*) AS n FROM groups WHERE tipo = 'parcela'").get() as { n: number };
    expect(count.n).toBe(0);

    sqlite.close();
  });
});
