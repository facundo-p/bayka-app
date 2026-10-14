import { FUNCTION_LIMIT, KIND } from './config.mjs';

const TOP = 5;

function sum(rows, field) {
  return rows.reduce((acc, r) => acc + r[field], 0);
}

function sectorLine(snapshot, sector) {
  const rows = snapshot.cube.filter((r) => r.sector === sector);
  const code = (kind) => sum(rows.filter((r) => r.kind === kind), 'code');
  const prod = code(KIND.prod) + code(KIND.styles);
  const ratio = prod ? (code(KIND.test) / prod).toFixed(2) : '—';
  return `  ${sector}: ${sum(rows, 'files')} archivos, prod ${prod}, test ${code(KIND.test)} (ratio ${ratio}), comentarios ${sum(rows, 'comment')}`;
}

function topLines(title, items, fmt) {
  return [title, ...items.slice(0, TOP).map((i) => `  ${fmt(i)}`)];
}

function byDesc(field) {
  return (a, b) => b[field] - a[field];
}

function totalsLine(label, snap) {
  const code = snap.cube.filter((r) => r.kind !== KIND.docs && r.kind !== KIND.generated);
  return `${label}: ${sum(code, 'files')} archivos · ${sum(code, 'code')} código · ${sum(code, 'comment')} comentario · ${sum(code, 'blank')} blanco`;
}

const ratio = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

function optionalLines(snap) {
  const out = [];
  if (snap.coverage) {
    out.push(`Cobertura: ${snap.coverage.sectors.map((c) => `${c.sector} ${ratio(c.linesCovered, c.linesTotal)} líneas / ${ratio(c.branchesCovered, c.branchesTotal)} branches`).join(', ')}; ${snap.coverage.sqlTestFiles} tests pgTAP`);
    out.push(...topLines('Producción sin tests:', snap.coverage.untested, (u) => `${u.code}  ${u.path}`));
  }
  if (snap.duplication) {
    const d = snap.duplication;
    out.push(`Duplicación: ${d.percentage}% (${d.clones} bloques, ${d.duplicatedLines} líneas)`);
    out.push(...topLines('Bloques duplicados:', d.top, (b) => `${b.lines}  ${b.a.path}:${b.a.start} ↔ ${b.b.path}:${b.b.start}`));
  }
  return out;
}

// Resumen compacto para el modelo: alcanza para redactar hallazgos sin leer el JSON.
export function summarize(payload) {
  const snap = payload.current;
  const sectors = [...new Set(snap.cube.map((r) => r.sector))];
  const overLimit = snap.functions.buckets.filter((b) => b.bucket !== `1-${FUNCTION_LIMIT}`);
  const lines = [
    `ref ${snap.run.ref} (${snap.run.sha.slice(0, 7)}, ${snap.run.commitDate.slice(0, 10)})`,
    totalsLine('Total', snap),
    ...(payload.base ? [totalsLine(`Base ${payload.base.run.ref}`, payload.base)] : []),
    'Por sector:', ...sectors.map((s) => sectorLine(snap, s)),
    `Funciones >${FUNCTION_LIMIT} líneas: ${sum(overLimit, 'count')}`,
    ...topLines('Archivos más largos:', [...snap.largestFiles].sort(byDesc('code')), (f) => `${f.code}  ${f.path}`),
    ...topLines('Funciones más largas:', [...snap.functions.top].sort(byDesc('lines')), (f) => `${f.lines}  ${f.path}:${f.line} ${f.name}`),
    ...(snap.hotspots ? topLines('Hotspots:', [...snap.hotspots].sort(byDesc('score')), (h) => `${h.code} líneas × ${h.commits} commits  ${h.path}`) : []),
    `Deuda: ${Object.entries(Object.groupBy(snap.debt, (d) => d.marker)).map(([m, rows]) => `${m} ${sum(rows, 'count')}`).join(', ')}`,
    ...optionalLines(snap),
    `Historial: ${payload.history.length} corrida(s) guardada(s)`,
  ];
  return lines.join('\n');
}
