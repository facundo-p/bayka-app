export const SCHEMA_VERSION = 1;

export const HISTORY_DIR = '.codebase-stats/history';

export const KIND = Object.freeze({
  prod: 'prod',
  test: 'test',
  styles: 'styles',
  generated: 'generated',
  docs: 'docs',
});

// El orden importa: gana la primera regla cuyo prefijo matchea.
export const SECTORS = Object.freeze([
  { sector: 'mobile', sub: 'app', prefix: 'mobile/app/' },
  { sector: 'mobile', sub: 'src', prefix: 'mobile/src/' },
  { sector: 'mobile', sub: 'tests', prefix: 'mobile/tests/' },
  { sector: 'mobile', sub: 'drizzle', prefix: 'mobile/drizzle/' },
  { sector: 'mobile', sub: 'config', prefix: 'mobile/' },
  { sector: 'web', sub: 'src', prefix: 'web/src/' },
  { sector: 'web', sub: 'scripts', prefix: 'web/scripts/' },
  { sector: 'web', sub: 'config', prefix: 'web/' },
  { sector: 'supabase', sub: 'migrations', prefix: 'supabase/migrations/' },
  { sector: 'supabase', sub: 'functions', prefix: 'supabase/functions/' },
  { sector: 'supabase', sub: 'tests', prefix: 'supabase/tests/' },
  { sector: 'supabase', sub: 'config', prefix: 'supabase/' },
  { sector: 'scripts', sub: 'scripts', prefix: 'scripts/' },
  { sector: 'contracts', sub: 'contracts', prefix: 'contracts/' },
  { sector: 'tooling', sub: 'github', prefix: '.github/' },
  { sector: 'tooling', sub: 'claude', prefix: '.claude/' },
  { sector: 'docs', sub: 'docs', prefix: 'docs/' },
]);

export const FALLBACK_SECTOR = Object.freeze({ sector: 'root', sub: 'root' });

export const EXCLUDED_PREFIXES = Object.freeze(['.planning/', 'tasks/', 'design_handoff_web_gestion/', '.expo/']);

export const EXCLUDED_FILES = Object.freeze(['package-lock.json']);

// Archivos versionados que no escribe nadie a mano.
export const GENERATED_PATTERNS = Object.freeze([
  /^supabase\/baseline_schema\.sql$/,
  /(^|\/)[^/]+\.d\.ts$/,
]);

export const TEST_PATTERNS = Object.freeze([
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /\.test\.sql$/,
  /(^|\/)__tests__\//,
  /(^|\/)__mocks__\//,
  /^mobile\/tests\//,
  /^supabase\/tests\//,
  /^web\/src\/test\//,
]);

export const STYLES_PATTERN = /\.styles\.ts$|\.css$/;

export const COMMENT_STYLE = Object.freeze({
  cLike: { line: ['//'], block: ['/*', '*/'], quotes: ['"', "'", '`'], jsxBraces: true },
  css: { line: [], block: ['/*', '*/'], quotes: ['"', "'"] },
  sql: { line: ['--'], block: ['/*', '*/'], quotes: ["'"] },
  hash: { line: ['#'], block: null, quotes: ['"', "'"] },
  text: null,
});

export const LANGUAGES = Object.freeze({
  ts: { name: 'TypeScript', comments: 'cLike', ast: true },
  tsx: { name: 'TSX', comments: 'cLike', ast: true },
  js: { name: 'JavaScript', comments: 'cLike', ast: true },
  mjs: { name: 'JavaScript', comments: 'cLike', ast: true, alias: 'js' },
  cjs: { name: 'JavaScript', comments: 'cLike', ast: true, alias: 'js' },
  sql: { name: 'SQL', comments: 'sql' },
  css: { name: 'CSS', comments: 'css' },
  sh: { name: 'Shell', comments: 'hash' },
  yml: { name: 'YAML', comments: 'hash' },
  yaml: { name: 'YAML', comments: 'hash', alias: 'yml' },
  py: { name: 'Python', comments: 'hash' },
  toml: { name: 'TOML', comments: 'hash' },
  html: { name: 'HTML', comments: 'text' },
  md: { name: 'Markdown', comments: 'text' },
});

export const FILE_SIZE_BUCKETS = Object.freeze([
  { key: '1-50', max: 50 },
  { key: '51-100', max: 100 },
  { key: '101-200', max: 200 },
  { key: '201-400', max: 400 },
  { key: '401-800', max: 800 },
  { key: '>800', max: Infinity },
]);

export const FUNCTION_LIMIT = 20;

export const FUNCTION_SIZE_BUCKETS = Object.freeze([
  { key: '1-20', max: FUNCTION_LIMIT },
  { key: '21-40', max: 40 },
  { key: '41-80', max: 80 },
  { key: '>80', max: Infinity },
]);

export const DEBT_MARKERS = Object.freeze({
  eslintDisable: /eslint-disable/g,
  tsIgnore: /@ts-ignore/g,
  tsExpectError: /@ts-expect-error/g,
  any: /:\s*any\b|\bas any\b|<any>|\bany\[\]/g,
  todo: /\b(TODO|FIXME|HACK|XXX)\b/g,
});

export const TOP_N = Object.freeze({ files: 20, functions: 20, hotspots: 15, fileChanges: 15 });

export const CHURN_MONTHS = 6;

// Lo que cuenta como código escrito a mano (buckets, top de archivos, hotspots, deltas).
export const CODE_KINDS = new Set([KIND.prod, KIND.test, KIND.styles]);

export const ANALYSIS = Object.freeze({ base: 'base', coverage: 'coverage', duplication: 'duplication', findings: 'findings' });

// Salidas intermedias (payload, dashboard, reportes de cobertura y duplicación). Gitignorado.
export const OUT_DIR = '.codebase-stats/out';
