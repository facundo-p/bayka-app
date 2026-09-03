import { esBranchDeProduccion } from '../entornoBranch';

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
