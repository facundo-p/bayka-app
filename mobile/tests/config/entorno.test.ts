import { esVarianteDePruebas, formatearEtiquetaBuild, formatearVersionApp } from '../../src/config/entorno';

describe('esVarianteDePruebas', () => {
  it('es true cuando extra.appVariant es "test" (APP_VARIANT=test en app.config.js)', () => {
    expect(esVarianteDePruebas({ appVariant: 'test' })).toBe(true);
  });

  it('es false para la variante prod', () => {
    expect(esVarianteDePruebas({ appVariant: 'prod' })).toBe(false);
  });

  it('es false si extra no existe', () => {
    expect(esVarianteDePruebas(undefined)).toBe(false);
  });
});

describe('formatearVersionApp', () => {
  it('muestra la versión de app.json', () => {
    expect(formatearVersionApp({ version: '1.0.0' })).toBe('v1.0.0');
  });
});

describe('formatearEtiquetaBuild', () => {
  it('versión + commit: el commit identifica el build que se está probando', () => {
    expect(formatearEtiquetaBuild({ version: '1.0.0' }, { commit: 'a1b2c3d' })).toBe('v1.0.0 · a1b2c3d');
  });

  it('sin commit degrada a solo la versión', () => {
    expect(formatearEtiquetaBuild({ version: '1.0.0' }, {})).toBe('v1.0.0');
  });

  it('conserva el sufijo -dirty del commit', () => {
    expect(formatearEtiquetaBuild({ version: '1.0.0' }, { commit: 'a1b2c3d-dirty' })).toBe('v1.0.0 · a1b2c3d-dirty');
  });
});
