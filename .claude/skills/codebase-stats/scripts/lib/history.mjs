import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HISTORY_DIR } from './config.mjs';

function historyDir(root) {
  return join(root, HISTORY_DIR);
}

export function snapshotFileName(snapshot) {
  const stamp = snapshot.run.generatedAt.replace(/[:.]/g, '-');
  return `${stamp}_${snapshot.run.sha.slice(0, 7)}.json`;
}

export function saveSnapshot(root, snapshot) {
  mkdirSync(historyDir(root), { recursive: true });
  const path = join(historyDir(root), snapshotFileName(snapshot));
  writeFileSync(path, JSON.stringify(snapshot));
  return path;
}

// Reescribe el snapshot solo si esa corrida ya estaba en el historial.
export function saveIfTracked(root, snapshot) {
  const path = join(historyDir(root), snapshotFileName(snapshot));
  if (existsSync(path)) writeFileSync(path, JSON.stringify(snapshot));
}

function readSnapshot(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    process.stderr.write(`Snapshot ilegible, se ignora: ${path}\n`);
    return null;
  }
}

// Orden cronológico por fecha del commit medido: un backfill cae en su lugar.
export function loadHistory(root) {
  let names;
  try {
    names = readdirSync(historyDir(root)).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  return names.map((n) => readSnapshot(join(historyDir(root), n))).filter(Boolean)
    .sort((a, b) => a.run.commitDate.localeCompare(b.run.commitDate) || a.run.generatedAt.localeCompare(b.run.generatedAt));
}
