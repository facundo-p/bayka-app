#!/usr/bin/env node
// Inyecta el payload (y los hallazgos, si los hay) en el template del dashboard.
// Los hallazgos también quedan en el snapshot guardado de esa corrida.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { repoRoot } from './lib/git.mjs';
import { saveIfTracked } from './lib/history.mjs';
import { ANALYSIS } from './lib/config.mjs';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'stats.template.html');
const PLACEHOLDER = '/*__PAYLOAD__*/null';

const OPTIONS = {
  payload: { type: 'string' },
  findings: { type: 'string' },
  out: { type: 'string' },
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// `</script>` dentro del JSON cerraría el tag que lo contiene.
export function embedJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function withFindings(payload, findings) {
  const same = (snap) => snap.run.generatedAt === payload.current.run.generatedAt;
  const attach = (snap) => ({ ...snap, findings, run: { ...snap.run, analyses: [...new Set([...snap.run.analyses, ANALYSIS.findings])] } });
  payload.current = attach(payload.current);
  payload.history = payload.history.map((s) => (same(s) ? attach(s) : s));
  saveIfTracked(repoRoot(), payload.current);
}

function main() {
  const { values: args } = parseArgs({ options: OPTIONS });
  if (!args.payload || !args.out) throw new Error('Uso: render.mjs --payload <json> --out <html> [--findings <json>]');
  const payload = readJson(args.payload);
  if (args.findings) withFindings(payload, readJson(args.findings));
  const html = readFileSync(TEMPLATE, 'utf8').replace(PLACEHOLDER, () => embedJson(payload));
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, html);
  process.stdout.write(`Dashboard: ${args.out}\n`);
}

main();
