import { esVarianteDePruebas, formatearVersionApp } from '../../src/config/entorno';

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
  it('muestra la versión y el versionCode de Android', () => {
    expect(formatearVersionApp({ version: '1.0.0', android: { versionCode: 3 } })).toBe('v1.0.0 (3)');
  });
});
