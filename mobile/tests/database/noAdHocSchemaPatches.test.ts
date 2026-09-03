/**
 * Guardrail (#312): drizzle es la única fuente de cambios de esquema. Un `ALTER TABLE` o
 * `PRAGMA user_version` suelto en src/database/ es la misma clase de bug que legacyPatches.ts
 * (columnas que dependen de re-ejecutar SQL a mano en vez de una migración versionada).
 */
import fs from 'fs';
import path from 'path';

const DATABASE_DIR = path.join(__dirname, '../../src/database');
// El wiring del migrator (useMigrations + drizzle/migrations) vive en app/_layout.tsx, fuera de
// src/database/ — no hay hoy ningún archivo acá que deba excluirse de este chequeo.
const MIGRATIONS_WIRING_FILES = new Set<string>();
const FORBIDDEN_PATTERNS = [/ALTER\s+TABLE/i, /PRAGMA\s+user_version/i];

function tsFilesIn(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
}

describe('src/database sin ad-hoc schema patches', () => {
  const files = tsFilesIn(DATABASE_DIR);

  it('encuentra al menos los archivos esperados (sanity check del glob)', () => {
    expect(files).toEqual(expect.arrayContaining(['schema.ts', 'sqliteErrors.ts']));
  });

  it.each(files)('%s no contiene ALTER TABLE ni PRAGMA user_version', (file) => {
    if (MIGRATIONS_WIRING_FILES.has(file)) return;
    const content = fs.readFileSync(path.join(DATABASE_DIR, file), 'utf8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
  });
});
