import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EspecieCatalogo, EspecieConUso } from '../../../queries/especieQueries';
import { aplicarCambiosEspecies } from '../../../repositories/plantationSpeciesRepository';
import { useSincronizarEspecies, useToggleEspecie } from '../useMutacionesEspecies';

vi.mock('../../../repositories/plantationSpeciesRepository', () => ({
  aplicarCambiosEspecies: vi.fn(),
}));

const CATALOGO: EspecieCatalogo[] = [
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: null },
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
  { id: 'sp-3', codigo: 'CE', nombre: 'Ceibo', nombreCientifico: null },
];

const HABILITADAS: EspecieConUso[] = [
  { ...CATALOGO[1], tieneArboles: false },
  { ...CATALOGO[0], tieneArboles: true },
];

/** Contrato de la clave: la misma que lee el checklist. */
const CLAVE = ['plantacion-especies', 'plant-1'];

/** Promesa que el test rechaza cuando quiere, para ver el estado optimista antes. */
function diferida() {
  let rechazar: (error: Error) => void = () => {};
  const promesa = new Promise<void>((_resolver, rechazo) => {
    rechazar = rechazo;
  });
  return { promesa, rechazar };
}

function montar<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(CLAVE, HABILITADAS);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

beforeEach(() => vi.clearAllMocks());

test('habilitar agrega la especie en su lugar alfabético antes de responder y la saca si falla', async () => {
  const alta = diferida();
  vi.mocked(aplicarCambiosEspecies).mockReturnValue(alta.promesa);
  const { result, queryClient } = montar(() => useToggleEspecie('plant-1', CATALOGO));

  act(() => result.current.mutate({ speciesId: 'sp-3', habilitar: true }));
  await waitFor(() =>
    expect(queryClient.getQueryData(CLAVE)).toEqual([
      HABILITADAS[0],
      { ...CATALOGO[2], tieneArboles: false },
      HABILITADAS[1],
    ]),
  );
  expect(aplicarCambiosEspecies).toHaveBeenCalledWith('plant-1', { altas: ['sp-3'], bajas: [] });

  act(() => alta.rechazar(new Error('sin permisos')));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(CLAVE)).toEqual(HABILITADAS);
});

test('quitar saca la especie al instante, manda solo la baja y la devuelve si falla', async () => {
  const baja = diferida();
  vi.mocked(aplicarCambiosEspecies).mockReturnValue(baja.promesa);
  const { result, queryClient } = montar(() => useToggleEspecie('plant-1', CATALOGO));

  act(() => result.current.mutate({ speciesId: 'sp-2', habilitar: false }));
  await waitFor(() => expect(queryClient.getQueryData(CLAVE)).toEqual([HABILITADAS[1]]));
  expect(aplicarCambiosEspecies).toHaveBeenCalledWith('plant-1', { altas: [], bajas: ['sp-2'] });

  act(() => baja.rechazar(new Error('sin red')));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(CLAVE)).toEqual(HABILITADAS);
});

test('el lote masivo se aplica entero y vuelve entero si falla', async () => {
  const lote = diferida();
  vi.mocked(aplicarCambiosEspecies).mockReturnValue(lote.promesa);
  const { result, queryClient } = montar(() => useSincronizarEspecies('plant-1', CATALOGO));

  act(() => result.current.mutate({ idsHabilitar: ['sp-3'], idsQuitar: ['sp-2'] }));
  await waitFor(() =>
    expect(queryClient.getQueryData(CLAVE)).toEqual([
      { ...CATALOGO[2], tieneArboles: false },
      HABILITADAS[1],
    ]),
  );

  act(() => lote.rechazar(new Error('sin permisos')));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(CLAVE)).toEqual(HABILITADAS);
});

test('el lote manda las altas y las bajas, no la lista final (#635)', async () => {
  vi.mocked(aplicarCambiosEspecies).mockResolvedValue(undefined);
  const { result } = montar(() => useSincronizarEspecies('plant-1', CATALOGO));

  act(() => result.current.mutate({ idsHabilitar: ['sp-3'], idsQuitar: ['sp-2'] }));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  // Una lista pisaría lo que un teléfono cambió en otras especies.
  expect(aplicarCambiosEspecies).toHaveBeenCalledWith('plant-1', {
    altas: ['sp-3'],
    bajas: ['sp-2'],
  });
});
