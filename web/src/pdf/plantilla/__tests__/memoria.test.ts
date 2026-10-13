import { conMemoria } from '../memoria';

test('calcula cada clave una sola vez', () => {
  const medir = vi.fn((texto: string) => texto.length);
  const conCache = conMemoria(medir);
  expect([conCache('Loma'), conCache('Loma'), conCache('Línea')]).toEqual([4, 4, 5]);
  expect(medir).toHaveBeenCalledTimes(2);
});
