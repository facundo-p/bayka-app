import { crearLimitador, mapearConConcurrencia } from '../concurrencia';

test('conserva el orden y nunca pasa del límite en vuelo', async () => {
  let enVuelo = 0;
  let maximo = 0;
  const resultado = await mapearConConcurrencia(
    [30, 5, 20, 1, 10, 2],
    2,
    async (demora, indice) => {
      enVuelo += 1;
      maximo = Math.max(maximo, enVuelo);
      await new Promise((resolver) => setTimeout(resolver, demora));
      enVuelo -= 1;
      return `${indice}:${demora}`;
    },
  );
  expect(resultado).toEqual(['0:30', '1:5', '2:20', '3:1', '4:10', '5:2']);
  expect(maximo).toBe(2);
});

test('sin items devuelve vacío', async () => {
  expect(await mapearConConcurrencia([], 4, async () => 1)).toEqual([]);
});

describe('crearLimitador', () => {
  test('entre llamadas sueltas nunca pasa del tope y todas terminan', async () => {
    const limitar = crearLimitador(2);
    let enVuelo = 0;
    let maximo = 0;
    const tarea = (demora: number) =>
      limitar(async () => {
        enVuelo += 1;
        maximo = Math.max(maximo, enVuelo);
        await new Promise((resolver) => setTimeout(resolver, demora));
        enVuelo -= 1;
        return demora;
      });
    const resultados = await Promise.all([tarea(20), tarea(5), tarea(10), tarea(1), tarea(3)]);
    expect(resultados).toEqual([20, 5, 10, 1, 3]);
    expect(maximo).toBe(2);
  });

  test('una tarea que falla libera su lugar', async () => {
    const limitar = crearLimitador(1);
    await expect(limitar(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(limitar(async () => 'sigue')).resolves.toBe('sigue');
  });
});
