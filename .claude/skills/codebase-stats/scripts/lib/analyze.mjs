import { classify } from './classify.mjs';
import { countLines } from './lines.mjs';
import { listFunctions } from './functions.mjs';
import { listBlobs, readBlobs } from './git.mjs';
import { DEBT_MARKERS, LANGUAGES, KIND } from './config.mjs';

// Las funciones de los tests (describe/it) son largas por diseño: solo cuenta producción.
const FUNCTION_KINDS = new Set([KIND.prod]);
const DEBT_KINDS = new Set([KIND.prod, KIND.test, KIND.styles]);

function countDebt(text) {
  const debt = {};
  for (const [marker, re] of Object.entries(DEBT_MARKERS)) debt[marker] = text.match(re)?.length ?? 0;
  return debt;
}

function analyzeFile(entry, text, ts) {
  const info = classify(entry.path);
  const record = { ...info, ...countLines(text, info.lang) };
  if (DEBT_KINDS.has(info.kind) && info.lang !== 'md') record.debt = countDebt(text);
  if (ts && FUNCTION_KINDS.has(info.kind) && LANGUAGES[info.lang].ast) {
    record.functions = listFunctions(ts, text, info.path, info.lang);
  }
  return record;
}

// Lee y analiza todos los archivos del ref; devuelve un registro por archivo.
export function analyzeRef(ref, ts) {
  const entries = listBlobs(ref).filter((e) => classify(e.path));
  const texts = readBlobs(entries.map((e) => e.sha));
  return entries.map((e) => analyzeFile(e, texts.get(e.sha), ts));
}
