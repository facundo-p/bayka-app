import type { ReactNode } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { listarPlantaciones } from '../../queries/plantationQueries';
import type { PlantacionConStats } from '../../queries/plantationQueries';
import type { ResultadoBusqueda } from '../../queries/buscarQueries';
import { CommandMenuProvider, useCommandMenu } from '../useCommandMenu';

vi.mock('../../queries/plantationQueries', () => ({ listarPlantaciones: vi.fn() }));
const listarPlantacionesMock = vi.mocked(listarPlantaciones);

const CLAVE_RECIENTES = 'bayka.command-menu.recientes';

function crearWrapper(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <CommandMenuProvider>{children}</CommandMenuProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function plantacionMinima(id: string, lugar: string): PlantacionConStats {
  return { id, lugar } as unknown as PlantacionConStats;
}

beforeEach(() => {
  window.localStorage.clear();
  listarPlantacionesMock.mockReset();
  listarPlantacionesMock.mockResolvedValue([]);
});

test('useCommandMenu fuera del provider lanza', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => renderHook(() => useCommandMenu())).toThrow(
    'useCommandMenu debe usarse dentro de CommandMenuProvider',
  );
  consoleError.mockRestore();
});

test('arranca cerrado; abrir/cerrar cambian el estado', () => {
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });
  expect(result.current.abierto).toBe(false);
  act(() => result.current.abrir());
  expect(result.current.abierto).toBe(true);
  act(() => result.current.cerrar());
  expect(result.current.abierto).toBe(false);
});

test('⌘K togglea abierto (ignora mayúscula/minúscula de la tecla)', () => {
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });
  act(() => {
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
  });
  expect(result.current.abierto).toBe(true);
  act(() => {
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
  });
  expect(result.current.abierto).toBe(false);
});

test('Ctrl+K (con K mayúscula) también dispara el atajo', () => {
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });
  act(() => {
    fireEvent.keyDown(document, { key: 'K', ctrlKey: true });
  });
  expect(result.current.abierto).toBe(true);
});

test('el atajo se ignora si el foco está en un campo de texto', () => {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });

  act(() => {
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
  });
  expect(result.current.abierto).toBe(false);
  document.body.removeChild(input);
});

test('arranca leyendo los recientes guardados en localStorage', () => {
  const guardados: ResultadoBusqueda[] = [
    { tipo: 'plantacion', id: 'p1', titulo: 'La Maluka', to: '/plantaciones/p1' },
  ];
  window.localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(guardados));
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });
  expect(result.current.recientes).toEqual(guardados);
});

test('JSON inválido en localStorage no rompe: arranca con recientes vacíos', () => {
  window.localStorage.setItem(CLAVE_RECIENTES, '{esto no es json');
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });
  expect(result.current.recientes).toEqual([]);
});

test('registrarReciente agrega al frente, deduplica por id y persiste en localStorage', () => {
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });
  const r1: ResultadoBusqueda = { tipo: 'plantacion', id: 'p1', titulo: 'Uno', to: '/1' };
  const r2: ResultadoBusqueda = { tipo: 'plantacion', id: 'p2', titulo: 'Dos', to: '/2' };

  act(() => result.current.registrarReciente(r1));
  act(() => result.current.registrarReciente(r2));
  act(() => result.current.registrarReciente(r1)); // repetido: sube al frente, no duplica

  expect(result.current.recientes).toEqual([r1, r2]);
  const persistido = JSON.parse(window.localStorage.getItem(CLAVE_RECIENTES)!);
  expect(persistido).toEqual([r1, r2]);
});

test('registrarReciente respeta el tope de 6, descartando los más viejos', () => {
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/') });
  for (let indice = 0; indice < 8; indice++) {
    const reciente: ResultadoBusqueda = {
      tipo: 'plantacion',
      id: `p${indice}`,
      titulo: `P${indice}`,
      to: `/${indice}`,
    };
    act(() => result.current.registrarReciente(reciente));
  }
  expect(result.current.recientes).toHaveLength(6);
  expect(result.current.recientes.map((reciente) => reciente.id)).toEqual([
    'p7',
    'p6',
    'p5',
    'p4',
    'p3',
    'p2',
  ]);
});

test('scope: en /plantaciones/:id resuelve plantationId y etiqueta desde la cache de plantaciones', async () => {
  listarPlantacionesMock.mockResolvedValue([plantacionMinima('plant-1', 'La Maluka')]);
  const { result } = renderHook(() => useCommandMenu(), {
    wrapper: crearWrapper('/plantaciones/plant-1'),
  });
  await waitFor(() => expect(result.current.scope?.etiqueta).toBe('La Maluka'));
  expect(result.current.scope).toEqual({ plantationId: 'plant-1', etiqueta: 'La Maluka' });
});

test('scope: etiqueta vacía si la plantación todavía no llegó de la query', async () => {
  listarPlantacionesMock.mockResolvedValue([]);
  const { result } = renderHook(() => useCommandMenu(), {
    wrapper: crearWrapper('/plantaciones/plant-x'),
  });
  await waitFor(() => expect(listarPlantacionesMock).toHaveBeenCalled());
  expect(result.current.scope).toEqual({ plantationId: 'plant-x', etiqueta: '' });
});

test('scope: fuera de /plantaciones/:id es null', async () => {
  listarPlantacionesMock.mockResolvedValue([plantacionMinima('plant-1', 'La Maluka')]);
  const { result } = renderHook(() => useCommandMenu(), { wrapper: crearWrapper('/especies') });
  await waitFor(() => expect(listarPlantacionesMock).toHaveBeenCalled());
  expect(result.current.scope).toBeNull();
});

/** Arnés con navegación real: limpiarScope() y la reactivación del scope
 *  dependen de cambios de ruta / de reapertura, que un renderHook aislado
 *  no puede disparar. */
function Arnes() {
  const commandMenu = useCommandMenu();
  const navigate = useNavigate();
  return (
    <div>
      <span data-testid="scope">{commandMenu.scope ? commandMenu.scope.plantationId : 'sin-scope'}</span>
      <button onClick={commandMenu.limpiarScope}>limpiar</button>
      <button onClick={commandMenu.abrir}>abrir</button>
      <button onClick={() => navigate('/plantaciones/plant-2')}>ir-a-plant-2</button>
    </div>
  );
}

function renderArnes(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <CommandMenuProvider>
          <Arnes />
        </CommandMenuProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('limpiarScope oculta el scope hasta que cambia de plantación', async () => {
  listarPlantacionesMock.mockResolvedValue([
    plantacionMinima('plant-1', 'La Maluka'),
    plantacionMinima('plant-2', 'Otra'),
  ]);
  renderArnes('/plantaciones/plant-1');
  await screen.findByText('plant-1');

  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole('button', { name: 'limpiar' }));
  expect(screen.getByTestId('scope')).toHaveTextContent('sin-scope');

  await usuario.click(screen.getByRole('button', { name: 'ir-a-plant-2' }));
  await screen.findByText('plant-2');
});

test('limpiarScope se revierte al reabrir la paleta (mismo plantationId)', async () => {
  listarPlantacionesMock.mockResolvedValue([plantacionMinima('plant-1', 'La Maluka')]);
  renderArnes('/plantaciones/plant-1');
  await screen.findByText('plant-1');

  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole('button', { name: 'limpiar' }));
  expect(screen.getByTestId('scope')).toHaveTextContent('sin-scope');

  await usuario.click(screen.getByRole('button', { name: 'abrir' }));
  await screen.findByText('plant-1');
});
