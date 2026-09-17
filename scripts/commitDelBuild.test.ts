import { commitDelBuild } from './commitDelBuild.cjs';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

/** `rev-parse` devuelve `sha`; `status` lista un cambio si el árbol está sucio. */
function gitFalso(sha: string, sucio: boolean) {
  return (...args: string[]) => {
    if (args[0] === 'rev-parse') return sha;
    return sucio ? ' M mobile/app.json' : '';
  };
}

describe('commitDelBuild', () => {
  it.each([
    ['el SHA del CI, sin -dirty aunque haya cambios', SHA, gitFalso('f'.repeat(40), true), 'a1b2c3d'],
    ['sin CI, el HEAD de git', undefined, gitFalso(SHA, false), 'a1b2c3d'],
    ['sin CI y con cambios sin commitear, -dirty', undefined, gitFalso(SHA, true), 'a1b2c3d-dirty'],
    ['sin CI ni git, vacío', undefined, gitFalso('', true), ''],
  ])('%s', (_caso, shaDelCi, git, esperado) => {
    expect(commitDelBuild(shaDelCi, git)).toBe(esperado);
  });
});
