import {
  SECTORS, FALLBACK_SECTOR, EXCLUDED_PREFIXES, EXCLUDED_FILES,
  GENERATED_PATTERNS, TEST_PATTERNS, STYLES_PATTERN, LANGUAGES, KIND,
} from './config.mjs';

export function languageOf(path) {
  const ext = path.split('/').pop().split('.').slice(1).pop()?.toLowerCase();
  const lang = LANGUAGES[ext];
  if (!lang) return null;
  return lang.alias ?? ext;
}

function sectorOf(path) {
  const rule = SECTORS.find((r) => path.startsWith(r.prefix));
  return rule ? { sector: rule.sector, sub: rule.sub } : { ...FALLBACK_SECTOR };
}

function kindOf(path, lang) {
  if (GENERATED_PATTERNS.some((re) => re.test(path))) return KIND.generated;
  if (lang === 'md') return KIND.docs;
  if (TEST_PATTERNS.some((re) => re.test(path))) return KIND.test;
  if (STYLES_PATTERN.test(path)) return KIND.styles;
  return KIND.prod;
}

function isExcluded(path) {
  const name = path.split('/').pop();
  return EXCLUDED_FILES.includes(name) || EXCLUDED_PREFIXES.some((p) => path.startsWith(p));
}

// null = el archivo no entra en las estadísticas.
export function classify(path) {
  if (isExcluded(path)) return null;
  const lang = languageOf(path);
  if (!lang) return null;
  return { path, lang, ...sectorOf(path), kind: kindOf(path, lang) };
}
