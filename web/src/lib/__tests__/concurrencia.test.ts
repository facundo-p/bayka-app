import { mapearConConcurrencia } from '../concurrencia';

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
