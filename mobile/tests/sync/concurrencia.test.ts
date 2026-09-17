import { conLimiteDeConcurrencia } from '../../src/services/sync/concurrencia';

/** Promesa que se resuelve/rechaza desde afuera, para controlar el orden exacto de finalización. */
function diferida<T = void>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

describe('conLimiteDeConcurrencia', () => {
  it('corre la tarea sobre todos los items', async () => {
    const vistos: number[] = [];

    await conLimiteDeConcurrencia([1, 2, 3, 4, 5], 2, async (n) => { vistos.push(n); });

    expect(vistos.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('nunca tiene más de `limite` en vuelo', async () => {
    let enVuelo = 0;
    let pico = 0;

    await conLimiteDeConcurrencia(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      enVuelo++;
      pico = Math.max(pico, enVuelo);
      await new Promise((r) => setTimeout(r, 1));
      enVuelo--;
    });

    expect(pico).toBe(3);
  });

  it('con límite 1 es estrictamente secuencial', async () => {
    const eventos: string[] = [];

    await conLimiteDeConcurrencia(['a', 'b'], 1, async (x) => {
      eventos.push(`inicio ${x}`);
      await new Promise((r) => setTimeout(r, 1));
      eventos.push(`fin ${x}`);
    });

    expect(eventos).toEqual(['inicio a', 'fin a', 'inicio b', 'fin b']);
  });

  it('un límite mayor que la cantidad de items no arranca obreros de más', async () => {
    let arrancados = 0;

    await conLimiteDeConcurrencia(['solo'], 5, async () => { arrancados++; });

    expect(arrancados).toBe(1);
  });

  // Un límite inválido tiene que degradar a secuencial, nunca a "no hacer nada":
  // eso saltearía todas las fotos pendientes devolviendo éxito.
  it('un límite de 0 corre igual, de a uno', async () => {
    const vistos: number[] = [];

    await conLimiteDeConcurrencia([1, 2, 3], 0, async (n) => { vistos.push(n); });

    expect(vistos).toEqual([1, 2, 3]);
  });

  it('lista vacía: no corre nada', async () => {
    const tarea = jest.fn();

    await conLimiteDeConcurrencia([], 3, tarea);

    expect(tarea).not.toHaveBeenCalled();
  });

  // Un throw que deja obreros corriendo sueltos escribe en la base después de que
  // el caller ya se dio por terminado.
  it('ante un error espera a los que ya estaban en vuelo antes de propagar', async () => {
    const lenta = diferida();
    let terminoLaLenta = false;

    const corrida = conLimiteDeConcurrencia(['falla', 'lenta'], 2, async (x) => {
      if (x === 'falla') throw new Error('se cayó');
      await lenta.promesa;
      terminoLaLenta = true;
    });

    await Promise.resolve();
    lenta.resolver();
    await expect(corrida).rejects.toThrow('se cayó');
    expect(terminoLaLenta).toBe(true);
  });

  // Con límite 1 el obrero que falla es el único y alcanza con su `return`. Lo que
  // hay que probar es que los OTROS obreros tampoco siguen tomando items.
  it('ante un error los demás obreros dejan de tomar items nuevos', async () => {
    const tocados: string[] = [];
    const lenta = diferida();

    const corrida = conLimiteDeConcurrencia(['lenta', 'falla', 'c', 'd'], 2, async (x) => {
      tocados.push(x);
      if (x === 'falla') throw new Error('se cayó');
      if (x === 'lenta') await lenta.promesa;
    });

    // El obrero de 'falla' ya rompió; el de 'lenta' sigue parado.
    await new Promise((r) => setTimeout(r, 0));
    lenta.resolver();

    await expect(corrida).rejects.toThrow('se cayó');
    expect(tocados).toEqual(['lenta', 'falla']);
  });

  it('propaga el primer error, no el último', async () => {
    const corrida = conLimiteDeConcurrencia([1, 2], 1, async (n) => {
      throw new Error(`error ${n}`);
    });

    await expect(corrida).rejects.toThrow('error 1');
  });
});
