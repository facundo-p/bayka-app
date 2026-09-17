import { algunaCargando, algunaConError, reintentarTodas, type EstadoConsulta } from '../consultas';

function consulta(estado: Partial<EstadoConsulta> = {}): EstadoConsulta {
  return { isPending: false, isError: false, refetch: vi.fn(), ...estado } as EstadoConsulta;
}

test('una sola query cargando o con error alcanza para la vista', () => {
  expect(algunaCargando([consulta(), consulta({ isPending: true })])).toBe(true);
  expect(algunaCargando([consulta(), consulta()])).toBe(false);
  expect(algunaConError([consulta({ isError: true }), consulta()])).toBe(true);
  expect(algunaConError([consulta()])).toBe(false);
});

test('reintentarTodas vuelve a pedir todas las queries', () => {
  const primera = consulta();
  const segunda = consulta();
  reintentarTodas([primera, segunda])();
  expect(primera.refetch).toHaveBeenCalledTimes(1);
  expect(segunda.refetch).toHaveBeenCalledTimes(1);
});
