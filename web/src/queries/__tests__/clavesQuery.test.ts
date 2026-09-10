import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { CLAVE_QUERY } from '../clavesQuery';

function invalidada(queryClient: QueryClient, clave: QueryKey): boolean | undefined {
  return queryClient.getQueryState(clave)?.isInvalidated;
}

test('invalidar por prefijo alcanza a todas las plantaciones y a ninguna otra familia', async () => {
  const queryClient = new QueryClient();
  const claves = [
    CLAVE_QUERY.plantacion('plant-1'),
    CLAVE_QUERY.plantacion('plant-2'),
    CLAVE_QUERY.plantaciones(),
    CLAVE_QUERY.plantacionUsuarios('plant-1'),
  ];
  for (const clave of claves) queryClient.setQueryData(clave, {});

  await queryClient.invalidateQueries({ queryKey: ['plantacion'] });

  expect(claves.map((clave) => invalidada(queryClient, clave))).toEqual([true, true, false, false]);
});

test('el primer segmento de cada familia es único', () => {
  const prefijos = Object.values(CLAVE_QUERY).map(
    (fabrica) => (fabrica as () => QueryKey)()[0],
  );

  expect(new Set(prefijos).size).toBe(prefijos.length);
});
