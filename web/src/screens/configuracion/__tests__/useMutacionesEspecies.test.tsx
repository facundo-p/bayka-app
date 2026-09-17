import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EspecieCatalogo, EspecieConUso } from '../../../queries/especieQueries';
import {
  agregarEspecie,
  quitarEspecie,
  sincronizarEspecies,
} from '../../../repositories/plantationSpeciesRepository';
import { useSincronizarEspecies, useToggleEspecie } from '../useMutacionesEspecies';

vi.mock('../../../repositories/plantationSpeciesRepository', () => ({
  agregarEspecie: vi.fn(),
  quitarEspecie: vi.fn(),
  sincronizarEspecies: vi.fn(),
}));

const CATALOGO: EspecieCatalogo[] = [
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: null },
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombreCientifico: null },
  { id: 'sp-3', codigo: 'CE', nombre: 'Ceibo', nombreCientifico: null },
];

const HABILITADAS: EspecieConUso[] = [
  { ...CATALOGO[0], ordenVisual: 0, tieneArboles: true },
  { ...CATALOGO[1], ordenVisual: 1, tieneArboles: false },
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

test('habilitar agrega la especie al final antes de responder y la saca si falla', async () => {
  const alta = diferida();
  vi.mocked(agregarEspecie).mockReturnValue(alta.promesa);
  const { result, queryClient } = montar(() => useToggleEspecie('plant-1', CATALOGO));

  act(() => result.current.mutate({ speciesId: 'sp-3', habilitar: true, orden: 2 }));
  await waitFor(() =>
    expect(queryClient.getQueryData(CLAVE)).toEqual([
      ...HABILITADAS,
      { ...CATALOGO[2], ordenVisual: 2, tieneArboles: false },
    ]),
  );

  act(() => alta.rechazar(new Error('sin permisos')));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(CLAVE)).toEqual(HABILITADAS);
});

test('quitar saca la especie al instante y la devuelve si falla', async () => {
  const baja = diferida();
  vi.mocked(quitarEspecie).mockReturnValue(baja.promesa);
  const { result, queryClient } = montar(() => useToggleEspecie('plant-1', CATALOGO));

  act(() => result.current.mutate({ speciesId: 'sp-2', habilitar: false, orden: 2 }));
  await waitFor(() => expect(queryClient.getQueryData(CLAVE)).toEqual([HABILITADAS[0]]));

  act(() => baja.rechazar(new Error('sin red')));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(CLAVE)).toEqual(HABILITADAS);
});

test('el lote masivo se aplica entero y vuelve entero si falla', async () => {
  const lote = diferida();
  vi.mocked(sincronizarEspecies).mockReturnValue(lote.promesa);
  const { result, queryClient } = montar(() => useSincronizarEspecies('plant-1', CATALOGO));

  act(() =>
    result.current.mutate({ idsHabilitar: ['sp-3'], idsQuitar: ['sp-2'], ordenInicial: 2 }),
  );
  await waitFor(() =>
    expect(queryClient.getQueryData(CLAVE)).toEqual([
      HABILITADAS[0],
      { ...CATALOGO[2], ordenVisual: 1, tieneArboles: false },
    ]),
  );

  act(() => lote.rechazar(new Error('sin permisos')));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(queryClient.getQueryData(CLAVE)).toEqual(HABILITADAS);
});
