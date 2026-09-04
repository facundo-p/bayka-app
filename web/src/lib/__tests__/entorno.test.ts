import { formatearEtiquetaBuild, VERSION_APP } from '../entorno';

describe('entorno · VERSION_APP', () => {
  it('formatea la versión de package.json con prefijo "v" (mismo formato que mobile)', () => {
    expect(VERSION_APP).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});

describe('formatearEtiquetaBuild', () => {
  it('versión + commit: el commit identifica el build que se está probando', () => {
    expect(formatearEtiquetaBuild('1.1.0', 'a1b2c3d')).toBe('v1.1.0 · a1b2c3d');
  });

  it('sin commit degrada a solo la versión', () => {
    expect(formatearEtiquetaBuild('1.1.0', '')).toBe('v1.1.0');
  });

  it('conserva el sufijo -dirty del commit', () => {
    expect(formatearEtiquetaBuild('1.1.0', 'a1b2c3d-dirty')).toBe('v1.1.0 · a1b2c3d-dirty');
  });
});
