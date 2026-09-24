import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './lib/classify.mjs';
import { countLines } from './lib/lines.mjs';
import { aggregate, bucketOf } from './lib/aggregate.mjs';
import { fileChanges } from './lib/delta.mjs';
import { FILE_SIZE_BUCKETS } from './lib/config.mjs';
import { summaryToFiles, untestedFiles } from './lib/coverage.mjs';
import { summarizeReport } from './lib/duplication.mjs';

test('classify: sector, sub-sector y tipo', () => {
  assert.deepEqual(classify('mobile/src/screens/Foo.tsx'), { path: 'mobile/src/screens/Foo.tsx', lang: 'tsx', sector: 'mobile', sub: 'src', kind: 'prod' });
  assert.equal(classify('mobile/src/screens/Foo.styles.ts').kind, 'styles');
  assert.equal(classify('mobile/tests/sync/Foo.test.ts').kind, 'test');
  assert.equal(classify('web/src/screens/__tests__/Bar.test.tsx').kind, 'test');
  assert.equal(classify('web/src/components/A.module.css').kind, 'styles');
  assert.equal(classify('supabase/tests/01_x.test.sql').kind, 'test');
  assert.equal(classify('supabase/migrations/001_x.sql').sub, 'migrations');
  assert.equal(classify('supabase/baseline_schema.sql').kind, 'generated');
  assert.equal(classify('docs/guia.md').kind, 'docs');
  assert.equal(classify('scripts/deploy.mjs').lang, 'js');
  assert.equal(classify('.github/workflows/ci.yaml').lang, 'yml');
  assert.equal(classify('README.md').sector, 'root');
});

test('classify: excluidos y sin lenguaje', () => {
  assert.equal(classify('.planning/STATE.md'), null);
  assert.equal(classify('mobile/package-lock.json'), null);
  assert.equal(classify('mobile/assets/icon.png'), null);
  assert.equal(classify('mobile/app.json'), null);
});

test('countLines: TS con comentarios de línea, bloque y JSX', () => {
  const src = [
    '// cabecera',
    'const a = 1; // al final: es código',
    '',
    '/* bloque',
    '',
    '   sigue */',
    "const glob = 'src/**/*.ts';",
    'const url = "https://x.com";',
    '{/* comentario JSX */}',
    'const t = `línea',
    '',
    '// no es comentario`;',
  ].join('\n');
  assert.deepEqual(countLines(src, 'tsx'), { code: 6, comment: 5, blank: 1 });
});

test('countLines: SQL, CSS y shell', () => {
  assert.deepEqual(countLines("-- c\nselect '--no';\n/* a\nb */\n\n", 'sql'), { code: 1, comment: 3, blank: 1 });
  assert.deepEqual(countLines('/* c */\n.a { color: red; }\n', 'css'), { code: 1, comment: 1, blank: 0 });
  assert.deepEqual(countLines('#!/bin/bash\necho "#no"\n  # c\n', 'sh'), { code: 1, comment: 2, blank: 0 });
});

test('countLines: markdown es todo texto salvo blancos', () => {
  assert.deepEqual(countLines('# Título\n\ntexto\n', 'md'), { code: 2, comment: 0, blank: 1 });
});

test('bucketOf respeta los límites inclusivos', () => {
  assert.equal(bucketOf(FILE_SIZE_BUCKETS, 50), '1-50');
  assert.equal(bucketOf(FILE_SIZE_BUCKETS, 51), '51-100');
  assert.equal(bucketOf(FILE_SIZE_BUCKETS, 801), '>800');
});

const rec = (path, sector, kind, code, extra = {}) => ({ path, sector, sub: 's', kind, lang: 'ts', code, comment: 1, blank: 1, ...extra });

test('aggregate: cubo, buckets, deuda, funciones y hotspots', () => {
  const records = [
    rec('a.ts', 'mobile', 'prod', 30, { debt: { any: 2, todo: 0 }, functions: [{ name: 'f', line: 1, lines: 25 }, { name: 'g', line: 30, lines: 5 }] }),
    rec('b.ts', 'mobile', 'prod', 900),
    rec('c.md', 'docs', 'docs', 10),
  ];
  const snap = aggregate(records, new Map([['a.ts', 3], ['c.md', 9]]));
  assert.equal(snap.cube.find((r) => r.sector === 'mobile').files, 2);
  assert.deepEqual(snap.fileSizes.map((f) => f.bucket).sort(), ['1-50', '>800']);
  assert.deepEqual(snap.debt, [{ sector: 'mobile', kind: 'prod', marker: 'any', count: 2 }]);
  assert.deepEqual(snap.functions.top.map((f) => f.name), ['f']);
  assert.deepEqual(snap.hotspots.map((h) => [h.path, h.score]), [['a.ts', 90]]);
});

test('fileChanges: crecimientos, achiques, altas y bajas', () => {
  const before = [rec('a.ts', 'web', 'prod', 10), rec('b.ts', 'web', 'prod', 50), rec('gone.ts', 'web', 'prod', 5)];
  const after = [rec('a.ts', 'web', 'prod', 40), rec('b.ts', 'web', 'prod', 20), rec('new.ts', 'web', 'test', 7)];
  const d = fileChanges(before, after);
  assert.deepEqual(d.grown.map((c) => [c.path, c.diff]), [['a.ts', 30], ['new.ts', 7]]);
  assert.deepEqual(d.shrunk.map((c) => [c.path, c.diff]), [['b.ts', -30], ['gone.ts', -5]]);
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
});

test('cobertura: summary de istanbul a filas y archivos sin tests', () => {
  const m = (total, covered) => ({ lines: { total, covered }, branches: { total: 2, covered: 1 } });
  const summary = { total: m(30, 10), '/repo/mobile/src/a.ts': m(20, 10), '/repo/mobile/src/b.tsx': m(10, 0), '/repo/mobile/src/c.styles.ts': m(5, 0) };
  const files = summaryToFiles('/repo', summary);
  assert.deepEqual(files.map((f) => f.path), ['mobile/src/a.ts', 'mobile/src/b.tsx', 'mobile/src/c.styles.ts']);
  const untested = untestedFiles(files, [rec('mobile/src/b.tsx', 'mobile', 'prod', 42)]);
  assert.deepEqual(untested, [{ path: 'mobile/src/b.tsx', sector: 'mobile', code: 42 }]);
});

test('duplicación: resumen del reporte de jscpd', () => {
  const file = (name, start) => ({ name, start, end: start + 9 });
  const report = {
    statistics: { total: { percentage: 1.5, duplicatedLines: 30, clones: 2 } },
    duplicates: [
      { lines: 10, firstFile: file('web/src/a.ts', 1), secondFile: file('web/src/b.ts', 5) },
      { lines: 20, firstFile: file('mobile/src/c.ts', 1), secondFile: file('web/src/d.ts', 1) },
    ],
  };
  const r = summarizeReport(report);
  assert.equal(r.percentage, 1.5);
  assert.deepEqual(r.top.map((d) => d.lines), [20, 10]);
  assert.deepEqual(Object.fromEntries(r.sectors.map((x) => [x.sector, x.duplicatedLines])), { web: 40, mobile: 20 });
});
