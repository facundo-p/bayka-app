import { conReloj } from '../../src/utils/conReloj';

describe('conReloj', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('devuelve el resultado si la tarea termina a tiempo', async () => {
    await expect(conReloj(Promise.resolve('listo'), 1000, () => new Error('tarde'))).resolves.toBe('listo');
  });

  it('propaga el error de la tarea, no el del reloj', async () => {
    const propio = new Error('falló la tarea');

    await expect(conReloj(Promise.reject(propio), 1000, () => new Error('tarde'))).rejects.toBe(propio);
  });

  it('al vencer rechaza con el error que arma el caller', async () => {
    const carrera = conReloj(new Promise(() => {}), 1000, () => new Error('tarde'));
    const afirmacion = expect(carrera).rejects.toThrow('tarde');

    jest.advanceTimersByTime(1000);

    await afirmacion;
  });

  // Un reloj vivo por cada llamada mantiene despierto el timer del runtime.
  it('limpia el reloj cuando la tarea gana la carrera', async () => {
    await conReloj(Promise.resolve('listo'), 1000, () => new Error('tarde'));

    expect(jest.getTimerCount()).toBe(0);
  });

  it('limpia el reloj también cuando la tarea falla', async () => {
    await conReloj(Promise.reject(new Error('x')), 1000, () => new Error('tarde')).catch(() => undefined);

    expect(jest.getTimerCount()).toBe(0);
  });
});
