#!/usr/bin/env node
// Mide la codebase en un ref de git (sin checkout), guarda el snapshot en el
// historial local y escribe el payload del dashboard. Imprime un resumen corto.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { SCHEMA_VERSION, CHURN_MONTHS, ANALYSIS } from './lib/config.mjs';
import { repoRoot, resolveRef, commitCounts } from './lib/git.mjs';
import { loadTypescript } from './lib/functions.mjs';
import { analyzeRef } from './lib/analyze.mjs';
import { aggregate } from './lib/aggregate.mjs';
import { fileChanges } from './lib/delta.mjs';
import { saveSnapshot, loadHistory } from './lib/history.mjs';
import { summarize } from './lib/summary.mjs';
import { measureCoverage } from './lib/coverage.mjs';
import { measureDuplication } from './lib/duplication.mjs';

const OPTIONS = {
  ref: { type: 'string', default: 'HEAD' },
  base: { type: 'string' },
  payload: { type: 'string' },
  'save-as-history': { type: 'boolean', default: false },
  'no-save': { type: 'boolean', default: false },
  coverage: { type: 'boolean', default: false },
  duplication: { type: 'boolean', default: false },
};

function monthsBefore(isoDate, months) {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

function measure(ref, ts, withChurn) {
  const run = resolveRef(ref);
  const records = analyzeRef(run.sha, ts);
  const commits = withChurn ? commitCounts(run.sha, monthsBefore(run.date, CHURN_MONTHS)) : null;
  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    run: { ref, sha: run.sha, commitDate: run.date, generatedAt: new Date().toISOString(), backfill: false, analyses: [ANALYSIS.base] },
    ...aggregate(records, commits),
  };
  return { snapshot, records };
}

// Solo es una foto del estado actual si mide HEAD, o si se pidió guardar un backfill.
function shouldSave(args) {
  if (args['no-save']) return false;
  return args.ref === 'HEAD' || args['save-as-history'];
}

// Cobertura y duplicación miden el working tree: solo tienen sentido sobre HEAD.
function addOptionalAnalyses(args, root, current) {
  if (args.ref !== 'HEAD') return;
  const snap = current.snapshot;
  if (args.coverage) {
    snap.coverage = measureCoverage(root, current.records);
    snap.run.analyses.push(ANALYSIS.coverage);
  }
  if (args.duplication) {
    snap.duplication = measureDuplication(root);
    snap.run.analyses.push(ANALYSIS.duplication);
  }
}

function main() {
  const { values: args } = parseArgs({ options: OPTIONS });
  const root = repoRoot();
  const ts = loadTypescript(root);
  const current = measure(args.ref, ts, true);
  const base = args.base ? measure(args.base, ts, false) : null;
  if (args.ref !== 'HEAD') current.snapshot.run.backfill = true;
  addOptionalAnalyses(args, root, current);
  if (shouldSave(args)) process.stderr.write(`Snapshot guardado: ${saveSnapshot(root, current.snapshot)}\n`);
  const payload = {
    current: current.snapshot,
    base: base?.snapshot ?? null,
    fileChanges: base ? fileChanges(base.records, current.records) : null,
    history: loadHistory(root),
  };
  if (args.payload) {
    mkdirSync(dirname(args.payload), { recursive: true });
    writeFileSync(args.payload, JSON.stringify(payload));
  }
  process.stdout.write(summarize(payload) + '\n');
}

main();
