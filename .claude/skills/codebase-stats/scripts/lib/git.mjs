import { execFileSync } from 'node:child_process';

const MAX_BUFFER = 512 * 1024 * 1024;

function git(args, input) {
  return execFileSync('git', args, { input, maxBuffer: MAX_BUFFER });
}

export function repoRoot() {
  return git(['rev-parse', '--show-toplevel']).toString().trim();
}

export function resolveRef(ref) {
  const [sha, date] = git(['log', '-1', '--format=%H%n%cI', ref]).toString().trim().split('\n');
  return { ref, sha, date };
}

// Lista los blobs de un ref sin tocar el working tree.
export function listBlobs(ref) {
  return git(['ls-tree', '-r', '-z', ref]).toString()
    .split('\0').filter(Boolean)
    .map((entry) => {
      const [meta, path] = entry.split('\t');
      const [, type, sha] = meta.split(' ');
      return { path, type, sha };
    })
    .filter((e) => e.type === 'blob');
}

// Lee muchos blobs en una sola llamada; devuelve Map<sha, texto>.
export function readBlobs(shas) {
  const unique = [...new Set(shas)];
  const out = git(['cat-file', '--batch'], unique.join('\n') + '\n');
  const texts = new Map();
  let pos = 0;
  for (const sha of unique) {
    const headerEnd = out.indexOf(0x0a, pos);
    const size = Number(out.subarray(pos, headerEnd).toString().split(' ')[2]);
    texts.set(sha, out.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8'));
    pos = headerEnd + 1 + size + 1;
  }
  return texts;
}

// Cantidad de commits (sin merges) que tocaron cada archivo desde `since` hasta `ref`.
export function commitCounts(ref, since) {
  const out = git(['log', '--no-merges', `--since=${since}`, '--format=', '--name-only', ref]).toString();
  const counts = new Map();
  for (const path of out.split('\n').filter(Boolean)) counts.set(path, (counts.get(path) ?? 0) + 1);
  return counts;
}
