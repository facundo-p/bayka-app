import { VERSION_APP } from '../entorno';

describe('entorno · VERSION_APP', () => {
  it('formatea la versión de package.json con prefijo "v" (mismo formato que mobile)', () => {
    expect(VERSION_APP).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});
