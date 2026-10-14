import { senalConEspera } from '../espera';

afterEach(() => vi.useRealTimers());

test('sin timeout nativo, aborta recién al cumplirse la espera', async () => {
  vi.useFakeTimers();
  const { senal } = senalConEspera(8000, false);
  await vi.advanceTimersByTimeAsync(7999);
  expect(senal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(senal.aborted).toBe(true);
});

test('sin timeout nativo, liberar suelta el timer y la señal no aborta', async () => {
  vi.useFakeTimers();
  const { senal, liberar } = senalConEspera(8000, false);
  liberar();
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(9000);
  expect(senal.aborted).toBe(false);
});

test('con timeout nativo usa AbortSignal.timeout', () => {
  const espia = vi.spyOn(AbortSignal, 'timeout');
  senalConEspera(8000, true);
  expect(espia).toHaveBeenCalledWith(8000);
  espia.mockRestore();
});
