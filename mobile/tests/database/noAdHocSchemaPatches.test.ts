/**
 * Guardrail (#312): drizzle es la única fuente de cambios de esquema. Un `ALTER TABLE` o
 * `PRAGMA user_version` suelto en src/ es la misma clase de bug que motivó este issue:
 * columnas que dependen de re-ejecutar SQL a mano en vez de una migración versionada.
 */
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.join(__dirname, '../../src');
const FORBIDDEN_PATTERNS = [/ALTER\s+TABLE/i, /PRAGMA\s+user_version/i];

function tsFilesIn(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...tsFilesIn(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      result.push(fullPath);
    }
  }
  return result;
}

describe('src sin ad-hoc schema patches', () => {
  const files = tsFilesIn(SRC_DIR);

  it('encuentra al menos los archivos esperados (sanity check del glob)', () => {
    const relative = files.map((f) => path.relative(SRC_DIR, f));
    expect(relative).toEqual(expect.arrayContaining([
      path.join('database', 'schema.ts'),
      path.join('database', 'sqliteErrors.ts'),
    ]));
  });

  it.each(files)('%s no contiene ALTER TABLE ni PRAGMA user_version', (file) => {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(content).not.toMatch(pattern);
    }
  });
});
