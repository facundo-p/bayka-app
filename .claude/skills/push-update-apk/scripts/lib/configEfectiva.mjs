/**
 * Config plugins efectivos de mobile para un canal, en el working tree o en un ref.
 * app.config.js suma plugins (algunos por variante) que app.json no lista.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { CANAL_OTA, VARIANTE } = createRequire(import.meta.url)(
  '../../../../../scripts/variantesMobile.cjs',
);
const EVALUADOR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'evaluarConfig.cjs');

// Gitignoreados que app.config.js necesita para cargarse igual que en el working tree.
const IGNORADOS_NECESARIOS = ['mobile/node_modules', '.env', 'mobile/.env', 'mobile/.env.staging'];

function entornoDelCanal(canal) {
  const env = { ...process.env, DOTENV_CONFIG_QUIET: 'true' };
  if (canal === CANAL_OTA.test) env.APP_VARIANT = VARIANTE.test;
  else delete env.APP_VARIANT;
  return env;
}

function evaluarPlugins(raiz, canal) {
  const mobile = path.join(raiz, 'mobile');
  const salida = execFileSync('node', [EVALUADOR, mobile], {
    cwd: mobile,
    env: entornoDelCanal(canal),
    encoding: 'utf8',
  });
  return JSON.parse(salida.trim().split('\n').at(-1));
}

/** Checkout temporal de `ref` con los gitignoreados linkeados; se borra al terminar. */
function conCheckout(ref, fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'nativos-base-'));
  const git = (...args) => execFileSync('git', args, { stdio: 'ignore' });
  git('worktree', 'add', '--detach', '-q', dir, ref);
  const links = IGNORADOS_NECESARIOS.filter((r) => existsSync(r)).map((r) => [
    r,
    path.join(dir, r),
  ]);
  try {
    for (const [ruta, link] of links) symlinkSync(path.resolve(ruta), link);
    return fn(dir);
  } finally {
    // Antes del remove, para que nada borre el contenido real de node_modules.
    for (const [, link] of links) rmSync(link, { force: true });
    git('worktree', 'remove', '--force', dir);
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Plugins efectivos del working tree (sin `ref`) o del commit `ref`. */
export function pluginsEfectivos(canal, ref) {
  if (!ref) return evaluarPlugins(process.cwd(), canal);
  return conCheckout(ref, (dir) => evaluarPlugins(dir, canal));
}
