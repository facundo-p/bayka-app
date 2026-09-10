/**
 * Commit corto del build para el banner de entorno de web y mobile (#321):
 * identifica QUÉ se está probando, cosa que la versión no hace porque `/deploy`
 * la bumpea recién al pasar a main. CommonJS y sin dependencias para que
 * `mobile/app.config.js` lo pueda requerir tal cual, también en EAS.
 */
const { execFileSync } = require('node:child_process');

/** El mismo largo que `git rev-parse --short` por defecto. */
const LARGO_COMMIT_CORTO = 7;
const SUFIJO_ARBOL_SUCIO = '-dirty';

/** Sin git disponible devuelve vacío: el commit nunca corta un build. */
function gitSiEsPosible(...args) {
  try {
    // Sin cwd: git busca el repo hacia arriba desde web/ o mobile/.
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * "a1b2c3d", o "a1b2c3d-dirty" si el build local tenía cambios sin commitear.
 * El hosting (Cloudflare Pages, EAS) buildea desde un checkout limpio y pasa su
 * SHA en `shaDelCi`; sin él se cae a git. Sin SHA devuelve vacío y el banner
 * muestra solo la versión.
 *
 * @param {string | undefined} shaDelCi
 * @param {(...args: string[]) => string} [git] reemplazable en los tests.
 * @returns {string}
 */
function commitDelBuild(shaDelCi, git = gitSiEsPosible) {
  const sha = shaDelCi || git('rev-parse', 'HEAD');
  if (!sha) return '';
  const sucio = !shaDelCi && git('status', '--porcelain') !== '';
  return sha.slice(0, LARGO_COMMIT_CORTO) + (sucio ? SUFIJO_ARBOL_SUCIO : '');
}

module.exports = { commitDelBuild };
