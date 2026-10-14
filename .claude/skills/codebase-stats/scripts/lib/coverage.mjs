import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { classify } from './classify.mjs';
import { KIND, OUT_DIR, TOP_N } from './config.mjs';

// Cada suite escribe su json-summary afuera del repo versionado (OUT_DIR está gitignorado).
const SUITES = Object.freeze([
  {
    sector: 'mobile',
    cwd: 'mobile',
    cmd: (dir) => ['npx', 'jest', '--ci', '--silent', '--coverage', '--coverageReporters=json-summary',
      `--coverageDirectory=${dir}`, '--collectCoverageFrom=src/**/*.{ts,tsx}', '--collectCoverageFrom=app/**/*.{ts,tsx}'],
  },
  {
    sector: 'web',
    cwd: 'web',
    cmd: (dir) => ['npx', 'vitest', 'run', '--silent', '--coverage.enabled', '--coverage.provider=istanbul',
      '--coverage.reporter=json-summary', `--coverage.reportsDirectory=${dir}`, '--coverage.all',
      '--coverage.include=src/**/*.{ts,tsx}'],
  },
]);

function runSuite(root, suite) {
  const dir = join(root, OUT_DIR, `coverage-${suite.sector}`);
  rmSync(dir, { recursive: true, force: true });
  const [bin, ...args] = suite.cmd(dir);
  try {
    execFileSync(bin, args, { cwd: join(root, suite.cwd), stdio: ['ignore', 'ignore', 'inherit'] });
  } catch {
    // Un test roto no invalida la medición: el summary se escribe igual.
    process.stderr.write(`La suite de ${suite.sector} terminó con fallas; se usa la cobertura que haya reportado.\n`);
  }
  return JSON.parse(readFileSync(join(dir, 'coverage-summary.json'), 'utf8'));
}

// Pasa el summary de istanbul (paths absolutos) a filas por archivo del repo.
export function summaryToFiles(root, summary) {
  return Object.entries(summary).filter(([k]) => k !== 'total').map(([abs, m]) => ({
    path: relative(root, abs),
    linesTotal: m.lines.total, linesCovered: m.lines.covered,
    branchesTotal: m.branches.total, branchesCovered: m.branches.covered,
  }));
}

function sectorTotals(sector, files) {
  const sum = (f) => files.reduce((a, x) => a + x[f], 0);
  return { sector, linesTotal: sum('linesTotal'), linesCovered: sum('linesCovered'),
    branchesTotal: sum('branchesTotal'), branchesCovered: sum('branchesCovered') };
}

// Archivos de producción que ningún test ejecuta.
export function untestedFiles(files, records) {
  const code = new Map(records.map((r) => [r.path, r.code]));
  return files.filter((f) => f.linesTotal > 0 && f.linesCovered === 0 && classify(f.path)?.kind === KIND.prod)
    .map((f) => ({ path: f.path, sector: classify(f.path).sector, code: code.get(f.path) ?? f.linesTotal }))
    .sort((a, b) => b.code - a.code)
    .slice(0, TOP_N.files * 2);
}

export function measureCoverage(root, records) {
  const perSuite = SUITES.map((s) => ({ sector: s.sector, files: summaryToFiles(root, runSuite(root, s)) }));
  const sqlTests = records.filter((r) => r.sector === 'supabase' && r.kind === KIND.test && r.lang === 'sql').length;
  return {
    sectors: perSuite.map((s) => sectorTotals(s.sector, s.files)),
    untested: untestedFiles(perSuite.flatMap((s) => s.files), records),
    sqlTestFiles: sqlTests,
  };
}
