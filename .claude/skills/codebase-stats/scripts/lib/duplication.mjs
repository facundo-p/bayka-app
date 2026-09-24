import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { classify } from './classify.mjs';
import { OUT_DIR, TOP_N } from './config.mjs';

const JSCPD = 'jscpd@4.0.5';
// Las migraciones redefinen funciones con CREATE OR REPLACE a propósito: fuera.
const TARGETS = Object.freeze(['mobile/src', 'mobile/app', 'web/src', 'supabase/functions', 'scripts']);
// Los tests repiten fixtures a propósito: no cuentan como duplicación.
const IGNORE = '**/*.test.*,**/__tests__/**,**/__mocks__/**,**/node_modules/**';
const MIN_TOKENS = '60';

function runJscpd(root, dir) {
  rmSync(dir, { recursive: true, force: true });
  execFileSync('npx', ['--yes', JSCPD, '--silent', '--reporters', 'json', '--output', dir,
    '--min-tokens', MIN_TOKENS, '--ignore', IGNORE, '--gitignore', ...TARGETS],
  { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  return JSON.parse(readFileSync(join(dir, 'jscpd-report.json'), 'utf8'));
}

function bySector(duplicates) {
  const lines = new Map();
  for (const d of duplicates) {
    for (const f of [d.firstFile, d.secondFile]) {
      const sector = classify(f.name)?.sector ?? 'root';
      lines.set(sector, (lines.get(sector) ?? 0) + d.lines);
    }
  }
  return [...lines].map(([sector, duplicatedLines]) => ({ sector, duplicatedLines }));
}

const place = (f) => ({ path: f.name, start: f.start, end: f.end });

export function summarizeReport(report) {
  const total = report.statistics.total;
  return {
    percentage: total.percentage,
    duplicatedLines: total.duplicatedLines,
    clones: total.clones,
    sectors: bySector(report.duplicates),
    top: [...report.duplicates].sort((a, b) => b.lines - a.lines).slice(0, TOP_N.files)
      .map((d) => ({ lines: d.lines, sector: classify(d.firstFile.name)?.sector ?? 'root', a: place(d.firstFile), b: place(d.secondFile) })),
  };
}

export function measureDuplication(root) {
  return summarizeReport(runJscpd(root, join(root, OUT_DIR, 'jscpd')));
}
