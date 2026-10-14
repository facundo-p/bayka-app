import { CODE_KINDS, FILE_SIZE_BUCKETS, FUNCTION_SIZE_BUCKETS, FUNCTION_LIMIT, TOP_N } from './config.mjs';

export function bucketOf(buckets, n) {
  return buckets.find((b) => n <= b.max).key;
}

function addTo(map, key, base, fn) {
  if (!map.has(key)) map.set(key, { ...base });
  fn(map.get(key));
}

function buildCube(records) {
  const cube = new Map();
  for (const r of records) {
    const base = { sector: r.sector, sub: r.sub, kind: r.kind, lang: r.lang, files: 0, code: 0, comment: 0, blank: 0 };
    addTo(cube, [r.sector, r.sub, r.kind, r.lang].join('|'), base, (row) => {
      row.files++; row.code += r.code; row.comment += r.comment; row.blank += r.blank;
    });
  }
  return [...cube.values()];
}

function buildFileSizes(records) {
  const sizes = new Map();
  for (const r of records.filter((x) => CODE_KINDS.has(x.kind) && x.code > 0)) {
    const bucket = bucketOf(FILE_SIZE_BUCKETS, r.code);
    addTo(sizes, [r.sector, r.kind, bucket].join('|'), { sector: r.sector, kind: r.kind, bucket, files: 0 }, (row) => { row.files++; });
  }
  return [...sizes.values()];
}

function buildDebt(records) {
  const debt = new Map();
  for (const r of records.filter((x) => x.debt)) {
    for (const [marker, count] of Object.entries(r.debt)) {
      if (!count) continue;
      addTo(debt, [r.sector, r.kind, marker].join('|'), { sector: r.sector, kind: r.kind, marker, count: 0 }, (row) => { row.count += count; });
    }
  }
  return [...debt.values()];
}

// Top N por sector, para que el filtro del dashboard siempre tenga qué mostrar.
export function topPerSector(items, n, score) {
  const bySector = Map.groupBy(items, (i) => i.sector);
  return [...bySector.values()].flatMap((list) => list.sort((a, b) => score(b) - score(a)).slice(0, n));
}

function buildFunctions(records) {
  const all = records.filter((r) => r.functions)
    .flatMap((r) => r.functions.map((f) => ({ ...f, path: r.path, sector: r.sector })));
  const buckets = new Map();
  for (const f of all) {
    const bucket = bucketOf(FUNCTION_SIZE_BUCKETS, f.lines);
    addTo(buckets, `${f.sector}|${bucket}`, { sector: f.sector, bucket, count: 0 }, (row) => { row.count++; });
  }
  const long = all.filter((f) => f.lines > FUNCTION_LIMIT);
  return { buckets: [...buckets.values()], top: topPerSector(long, TOP_N.functions, (f) => f.lines) };
}

function largestFiles(records) {
  const code = records.filter((r) => CODE_KINDS.has(r.kind))
    .map(({ path, sector, kind, lang, code }) => ({ path, sector, kind, lang, code }));
  return topPerSector(code, TOP_N.files, (f) => f.code);
}

// Tamaño × commits recientes: archivos grandes que además cambian seguido.
function buildHotspots(records, commits) {
  const scored = records.filter((r) => CODE_KINDS.has(r.kind) && commits.has(r.path))
    .map(({ path, sector, kind, code }) => {
      const n = commits.get(path);
      return { path, sector, kind, code, commits: n, score: code * n };
    });
  return topPerSector(scored, TOP_N.hotspots, (h) => h.score);
}

export function aggregate(records, commits) {
  return {
    cube: buildCube(records),
    fileSizes: buildFileSizes(records),
    debt: buildDebt(records),
    functions: buildFunctions(records),
    largestFiles: largestFiles(records),
    hotspots: commits ? buildHotspots(records, commits) : null,
  };
}
