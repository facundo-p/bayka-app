import { formatearPeso } from '../../src/utils/pesoDeArchivos';

const MB = 1024 * 1024;

describe('formatearPeso', () => {
  it.each([
    [0, '0 KB'],
    [100, '1 KB'],
    [850 * 1024, '850 KB'],
    [4.2 * MB, '4,2 MB'],
    [41 * MB, '41 MB'],
    [74.4 * MB, '74 MB'],
    [1.2 * 1024 * MB, '1,2 GB'],
  ])('%d bytes → %s', (bytes, texto) => {
    expect(formatearPeso(bytes)).toBe(texto);
  });
});
