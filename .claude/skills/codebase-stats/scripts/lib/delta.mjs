import { CODE_KINDS, TOP_N } from './config.mjs';

function codeByPath(records) {
  return new Map(records.filter((r) => CODE_KINDS.has(r.kind)).map((r) => [r.path, r]));
}

// Archivos que más crecieron y más se achicaron entre base y ref (incluye altas y bajas).
export function fileChanges(baseRecords, records) {
  const before = codeByPath(baseRecords);
  const after = codeByPath(records);
  const paths = new Set([...before.keys(), ...after.keys()]);
  const changes = [...paths].map((path) => {
    const b = before.get(path);
    const a = after.get(path);
    return { path, sector: (a ?? b).sector, before: b?.code ?? null, after: a?.code ?? null, diff: (a?.code ?? 0) - (b?.code ?? 0) };
  }).filter((c) => c.diff !== 0);
  const byDiff = changes.sort((x, y) => y.diff - x.diff);
  return {
    grown: byDiff.filter((c) => c.diff > 0).slice(0, TOP_N.fileChanges),
    shrunk: byDiff.filter((c) => c.diff < 0).reverse().slice(0, TOP_N.fileChanges),
    added: changes.filter((c) => c.before === null).length,
    removed: changes.filter((c) => c.after === null).length,
  };
}
