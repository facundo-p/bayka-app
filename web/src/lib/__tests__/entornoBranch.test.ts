import { abreviarCommit, esBranchDeProduccion } from '../entornoBranch';

describe('esBranchDeProduccion', () => {
  it('main es producción', () => {
    expect(esBranchDeProduccion('main')).toBe(true);
  });

  it('staging es entorno de pruebas', () => {
    expect(esBranchDeProduccion('staging')).toBe(false);
  });

  it('una feature branch (preview de Pages) es entorno de pruebas', () => {
    expect(esBranchDeProduccion('feat/banner')).toBe(false);
  });

  it('sin CF_PAGES_BRANCH (dev local) es entorno de pruebas', () => {
    expect(esBranchDeProduccion(undefined)).toBe(false);
  });
});

describe('abreviarCommit', () => {
  const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

  it('abrevia el SHA completo a 7 caracteres', () => {
    expect(abreviarCommit(SHA, false)).toBe('a1b2c3d');
  });

  it('marca -dirty cuando el árbol tenía cambios sin commitear', () => {
    expect(abreviarCommit(SHA, true)).toBe('a1b2c3d-dirty');
  });

  it('sin SHA devuelve vacío (el banner degrada a mostrar solo la versión)', () => {
    expect(abreviarCommit(undefined, false)).toBe('');
    expect(abreviarCommit('', true)).toBe('');
  });
});
