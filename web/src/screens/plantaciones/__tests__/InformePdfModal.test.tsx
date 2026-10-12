import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Plantacion } from '../../../queries/plantationQueries';
import { descargarInformePdf } from '../../../services/pdfInforme';
import { plantacion as fabricarPlantacion } from '../../../test/fabricas';
import { InformePdfModal } from '../InformePdfModal';
import { useInformePdf } from '../useInformePdf';

vi.mock('../../../services/pdfInforme', () => ({ descargarInformePdf: vi.fn() }));

const CLAVE = 'bayka.informe.opciones';
const CON_META = fabricarPlantacion({ id: 'p1', objetivoArboles: 8000 });
const SIN_META = fabricarPlantacion({ id: 'p2', objetivoArboles: null });
const CASILLAS = [
  'Meta y avance',
  'Porcentaje con GPS',
  'Porcentaje con foto',
  'Mapa de puntos GPS',
];

/** El menú de la barra reducido a un botón. */
function Detalle({ plantacion }: { plantacion: Plantacion }) {
  const informe = useInformePdf(plantacion);
  return (
    <>
      <button onClick={informe.abrir}>Informe PDF</button>
      {informe.abierto && <InformePdfModal informe={informe} />}
    </>
  );
}

function renderizar(plantacion = CON_META) {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <Detalle plantacion={plantacion} />
    </QueryClientProvider>,
  );
  return { usuario: userEvent.setup(), queryClient };
}

async function abrir(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: 'Informe PDF' }));
  return screen.getByRole('dialog', { name: 'Informe PDF' });
}

const casilla = (nombre: string) => screen.getByRole('checkbox', { name: nombre });
const marcadas = () =>
  screen
    .getAllByRole('checkbox')
    .filter((elemento) => elemento.getAttribute('aria-checked') === 'true')
    .map((elemento) => elemento.getAttribute('aria-label'));

/** Una descarga que termina cuando el test lo decide. */
function descargaPendiente() {
  let terminar: (error?: Error) => void = () => {};
  vi.mocked(descargarInformePdf).mockImplementationOnce(
    () =>
      new Promise<void>((resolver, rechazar) => {
        terminar = (error) => (error ? rechazar(error) : resolver());
      }),
  );
  return (error?: Error) => terminar(error);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(descargarInformePdf).mockReset();
  vi.mocked(descargarInformePdf).mockResolvedValue();
});

afterEach(() => vi.restoreAllMocks());

test('la primera vez, las cuatro casillas arrancan sin marcar', async () => {
  const { usuario } = renderizar();
  const modal = await abrir(usuario);
  expect(
    within(modal)
      .getAllByRole('checkbox')
      .map((c) => c.getAttribute('aria-label')),
  ).toEqual(CASILLAS);
  expect(marcadas()).toEqual([]);
  expect(casilla('Meta y avance')).toBeEnabled();
});

test('genera con las opciones elegidas, cierra el modal y las recuerda al reabrir', async () => {
  const { usuario, queryClient } = renderizar();
  await abrir(usuario);
  await usuario.click(casilla('Porcentaje con GPS'));
  await usuario.click(casilla('Mapa de puntos GPS'));
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(descargarInformePdf).toHaveBeenCalledWith(CON_META, queryClient, {
    meta: false,
    gps: true,
    foto: false,
    mapa: true,
  });
  await abrir(usuario);
  expect(marcadas()).toEqual(['Porcentaje con GPS', 'Mapa de puntos GPS']);
});

test('cancelar no genera ni cambia lo recordado', async () => {
  window.localStorage.setItem(CLAVE, '["foto"]');
  const { usuario } = renderizar();
  await abrir(usuario);
  await usuario.click(casilla('Meta y avance'));
  await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

  expect(descargarInformePdf).not.toHaveBeenCalled();
  await abrir(usuario);
  expect(marcadas()).toEqual(['Porcentaje con foto']);
});

test('con el storage bloqueado arrancan sin marcar y el informe se genera igual', async () => {
  const error = new DOMException('bloqueado', 'SecurityError');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw error;
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw error;
  });
  const { usuario } = renderizar();
  await abrir(usuario);
  expect(marcadas()).toEqual([]);
  await usuario.click(casilla('Porcentaje con foto'));
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));
  await waitFor(() => expect(descargarInformePdf).toHaveBeenCalledTimes(1));
  expect(vi.mocked(descargarInformePdf).mock.calls[0][2]).toMatchObject({ foto: true });
});

describe('sin objetivo de árboles', () => {
  test('la casilla de meta queda deshabilitada, sin marcar y dice por qué', async () => {
    window.localStorage.setItem(CLAVE, '["meta","gps"]');
    const { usuario } = renderizar(SIN_META);
    await abrir(usuario);
    const meta = casilla('Meta y avance');
    expect(meta).toBeDisabled();
    expect(meta).toHaveAttribute('aria-checked', 'false');
    expect(meta).toHaveAccessibleDescription(/Meta no definida/);
    expect(marcadas()).toEqual(['Porcentaje con GPS']);
  });

  test('genera sin meta pero la deja recordada para las plantaciones que tienen', async () => {
    window.localStorage.setItem(CLAVE, '["meta","gps"]');
    const { usuario } = renderizar(SIN_META);
    await abrir(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));
    await waitFor(() => expect(descargarInformePdf).toHaveBeenCalledTimes(1));
    expect(vi.mocked(descargarInformePdf).mock.calls[0][2]).toMatchObject({ meta: false });
    expect(window.localStorage.getItem(CLAVE)).toBe('["meta","gps"]');
  });
});

test('mientras genera, el botón muestra la carga y no responde dos veces', async () => {
  const terminar = descargaPendiente();
  const { usuario } = renderizar();
  await abrir(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));

  const generando = screen.getByRole('button', { name: /Generando…/ });
  expect(generando).toBeDisabled();
  await usuario.click(generando);
  expect(descargarInformePdf).toHaveBeenCalledTimes(1);
  expect(casilla('Mapa de puntos GPS')).toBeDisabled();
  terminar();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('si falla, avisa en el modal, que queda abierto para reintentar', async () => {
  vi.mocked(descargarInformePdf).mockRejectedValueOnce(new Error('canvas'));
  const { usuario } = renderizar();
  const modal = await abrir(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));

  expect(await within(modal).findByRole('alert')).toHaveTextContent(
    'No se pudo generar el informe PDF.',
  );
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(descargarInformePdf).toHaveBeenCalledTimes(2);
});

// El render no se puede cortar: cerrar a mitad dejaría bajar el PDF igual.
test('mientras genera no se cierra: ni Cancelar, ni Escape, ni el clic afuera', async () => {
  const terminar = descargaPendiente();
  const { usuario } = renderizar();
  const modal = await abrir(usuario);
  await usuario.click(screen.getByRole('button', { name: 'Generar informe' }));

  const cancelar = screen.getByRole('button', { name: 'Cancelar' });
  expect(cancelar).toBeDisabled();
  await usuario.click(cancelar);
  await usuario.keyboard('{Escape}');
  // El fondo oscuro que rodea al diálogo.
  await usuario.click(modal.parentElement!);
  expect(screen.getByRole('dialog', { name: 'Informe PDF' })).toBeInTheDocument();

  terminar(new Error('canvas'));
  expect(await within(modal).findByRole('alert')).toHaveTextContent(
    'No se pudo generar el informe PDF.',
  );
  expect(cancelar).toBeEnabled();
  await usuario.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
