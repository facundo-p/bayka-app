/**
 * La marca de actividad decide si el banner de OTA puede ofrecer reiniciar la app
 * (#446). Un contador que se queda encendido bloquea el botón para siempre; uno
 * que se apaga de más ofrece reiniciar en medio de una escritura.
 */
import {
  hayActividadDeSync,
  subscribeActividadDeSync,
  marcandoActividadDeSync,
  __resetActividadDeSync,
} from '../../src/services/sync/syncActivityStore';

const diferido = <T,>(valor: T) => new Promise<T>((resolve) => setImmediate(() => resolve(valor)));

describe('syncActivityStore', () => {
  afterEach(() => __resetActividadDeSync());

  it('arranca inactivo', () => {
    expect(hayActividadDeSync()).toBe(false);
  });

  it('marca actividad mientras corre el orquestador y la apaga al terminar', async () => {
    const decorada = marcandoActividadDeSync(async () => {
      expect(hayActividadDeSync()).toBe(true);
      return diferido('listo');
    });

    const promesa = decorada();
    expect(hayActividadDeSync()).toBe(true);
    await expect(promesa).resolves.toBe('listo');
    expect(hayActividadDeSync()).toBe(false);
  });

  it('apaga la marca aunque el orquestador falle', async () => {
    const decorada = marcandoActividadDeSync(async () => {
      throw new Error('sin red');
    });

    await expect(decorada()).rejects.toThrow('sin red');
    expect(hayActividadDeSync()).toBe(false);
  });

  it('con dos corridas solapadas sigue activo hasta que termina la segunda', async () => {
    let resolverPrimera!: () => void;
    let resolverSegunda!: () => void;
    const primera = marcandoActividadDeSync(() => new Promise<void>((r) => { resolverPrimera = r; }));
    const segunda = marcandoActividadDeSync(() => new Promise<void>((r) => { resolverSegunda = r; }));

    const p1 = primera();
    const p2 = segunda();
    expect(hayActividadDeSync()).toBe(true);

    resolverPrimera();
    await p1;
    expect(hayActividadDeSync()).toBe(true); // la segunda sigue

    resolverSegunda();
    await p2;
    expect(hayActividadDeSync()).toBe(false);
  });

  it('preserva argumentos y valor de retorno', async () => {
    const decorada = marcandoActividadDeSync(async (a: number, b: string) => `${a}-${b}`);
    await expect(decorada(7, 'x')).resolves.toBe('7-x');
  });

  it('notifica solo en los bordes de actividad', async () => {
    const notificaciones: boolean[] = [];
    subscribeActividadDeSync((activo) => notificaciones.push(activo));

    let resolverPrimera!: () => void;
    let resolverSegunda!: () => void;
    const p1 = marcandoActividadDeSync(() => new Promise<void>((r) => { resolverPrimera = r; }))();
    const p2 = marcandoActividadDeSync(() => new Promise<void>((r) => { resolverSegunda = r; }))();

    resolverPrimera();
    await p1;
    resolverSegunda();
    await p2;

    expect(notificaciones).toEqual([true, false]);
  });

  it('desuscribirse corta las notificaciones', async () => {
    const notificaciones: boolean[] = [];
    const unsubscribe = subscribeActividadDeSync((activo) => notificaciones.push(activo));
    unsubscribe();

    await marcandoActividadDeSync(async () => undefined)();

    expect(notificaciones).toEqual([]);
  });
});
