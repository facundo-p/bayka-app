import { esperarHasta } from '../../src/utils/esperarHasta';

describe('esperarHasta', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const opciones = (respondio: boolean) => ({ respondio: () => respondio, alVencer: jest.fn(), siVence: 'vencio' });

  it('devuelve lo que responde antes del tope', async () => {
    const o = opciones(false);
    await expect(esperarHasta(Promise.resolve('ok'), 100, o)).resolves.toBe('ok');
    expect(o.alVencer).not.toHaveBeenCalled();
  });

  it('sin respuesta al tope, avisa que venció y devuelve siVence', async () => {
    const o = opciones(false);
    const espera = esperarHasta(new Promise<string>(() => {}), 100, o);
    await jest.advanceTimersByTimeAsync(100);
    await expect(espera).resolves.toBe('vencio');
    expect(o.alVencer).toHaveBeenCalled();
  });

  it('si ya respondió, el tope no vence: espera a que termine de registrar', async () => {
    const o = opciones(true);
    let terminar: (v: string) => void = () => {};
    const espera = esperarHasta(new Promise<string>((r) => { terminar = r; }), 100, o);
    await jest.advanceTimersByTimeAsync(100);
    terminar('registrado');
    await expect(espera).resolves.toBe('registrado');
    expect(o.alVencer).not.toHaveBeenCalled();
  });
});
