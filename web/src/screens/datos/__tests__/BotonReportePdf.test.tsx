import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { contarArbolesDelFiltro, type FiltrosArboles } from '../../../queries/dataExplorerQueries';
import {
  descargarReportePdf,
  ETAPA_REPORTE,
  type PedidoDescargaReporte,
  type ProgresoReporte,
} from '../../../services/pdfReporte';
import { plantacion } from '../../../test/fabricas';
import { BotonReportePdf } from '../BotonReportePdf';

vi.mock('../../../queries/dataExplorerQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../queries/dataExplorerQueries')>()),
  contarArbolesDelFiltro: vi.fn(),
}));
vi.mock('../../../services/pdfReporte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pdfReporte')>()),
  descargarReportePdf: vi.fn(),
}));

const PLANTACION = plantacion({ id: 'plant-1', lugar: 'San Sebastián', periodo: '2025-2026' });
const FILTROS: FiltrosArboles = { conFoto: true, busqueda: 'L23' };
const CATALOGOS = { parcelas: [], grupos: [], especies: [] };

type Generacion = {
  pedido: PedidoDescargaReporte;
  progresar: (progreso: ProgresoReporte) => void;
  terminar: (fotosFallidas?: number) => void;
  fallar: () => void;
};

/** La descarga queda abierta hasta que el test la termina; abortada, rechaza como la real. */
function generacionControlada(): { actual: () => Generacion } {
  let actual: Generacion | null = null;
  vi.mocked(descargarReportePdf).mockImplementation(
    (pedido) =>
      new Promise((resolve, reject) => {
        pedido.senal?.addEventListener('abort', () => reject(pedido.senal?.reason));
        actual = {
          pedido,
          progresar: (progreso) => act(() => pedido.alProgresar?.(progreso)),
          terminar: (fotosFallidas = 0) => resolve({ fotosFallidas }),
          fallar: () => reject(new Error('sin red')),
        };
      }),
  );
  return { actual: () => actual! };
}

function renderBoton(hayArboles = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <BotonReportePdf
        plantacion={PLANTACION}
        filtros={FILTROS}
        catalogos={CATALOGOS}
        hayArboles={hayArboles}
      />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

async function abrir(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: 'Reporte PDF' }));
  const dialogo = screen.getByRole('dialog', { name: 'Reporte PDF de árboles' });
  await within(dialogo).findByText(/en el filtro/);
  return within(dialogo);
}

const opcion = (modal: ReturnType<typeof within>, nombre: RegExp) =>
  modal.getByRole('radio', { name: nombre });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 7124, conFoto: 148 });
});

test('sin árboles en el filtro el botón queda deshabilitado', () => {
  renderBoton(false);
  expect(screen.getByRole('button', { name: 'Reporte PDF' })).toBeDisabled();
});

test('sin la plantación cargada el botón queda deshabilitado', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BotonReportePdf plantacion={null} filtros={{}} catalogos={CATALOGOS} hayArboles />
    </QueryClientProvider>,
  );
  expect(screen.getByRole('button', { name: 'Reporte PDF' })).toBeDisabled();
});

describe('al abrir', () => {
  test('cuenta los árboles del filtro y estima hojas y peso de cada modo', async () => {
    const modal = await abrir(renderBoton());
    expect(contarArbolesDelFiltro).toHaveBeenCalledWith('plant-1', FILTROS);
    expect(modal.getByText('7.124 árboles en el filtro, 148 con foto.')).toBeInTheDocument();
    expect(opcion(modal, /Con fotos/)).toHaveAccessibleName('Con fotos 148 tarjetas con foto');
    expect(modal.getByText(/^251 hojas · ≈ 14 MB$/)).toBeInTheDocument();
    await userEvent.setup().click(opcion(modal, /Sin fotos/));
    expect(modal.getByText(/^230 hojas · ≈ 3,5 MB$/)).toBeInTheDocument();
  });

  test('sin árboles con foto, «Con fotos» queda apagado y dice por qué', async () => {
    vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 50, conFoto: 0 });
    const modal = await abrir(renderBoton());
    expect(opcion(modal, /Con fotos/)).toBeDisabled();
    expect(opcion(modal, /Con fotos/)).toHaveAccessibleName('Con fotos Ningún árbol con foto');
    expect(opcion(modal, /Sin fotos/)).toBeChecked();
  });

  test('pasado el tope de tarjetas, avisa cuántas van al listado; sin fotos, no', async () => {
    vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 900, conFoto: 512 });
    const usuario = renderBoton();
    const modal = await abrir(usuario);
    expect(modal.getByRole('status')).toHaveTextContent('Los otros 112 van al listado, sin foto.');
    await usuario.click(opcion(modal, /Sin fotos/));
    expect(modal.queryByText(/van al listado/)).not.toBeInTheDocument();
  });

  test('si el conteo falla, se puede reintentar', async () => {
    vi.mocked(contarArbolesDelFiltro).mockRejectedValueOnce(new Error('sin red'));
    const usuario = renderBoton();
    await usuario.click(screen.getByRole('button', { name: 'Reporte PDF' }));
    const modal = within(screen.getByRole('dialog'));
    expect(await modal.findByText('No se pudieron contar los árboles.')).toBeInTheDocument();
    expect(modal.getByRole('button', { name: 'Generar PDF' })).toBeDisabled();
    await usuario.click(modal.getByRole('button', { name: 'Reintentar' }));
    expect(await modal.findByText(/en el filtro/)).toBeInTheDocument();
  });
});

describe('al generar', () => {
  test('pide el reporte con el filtro, el modo y el nombre, y muestra cada etapa', async () => {
    const { actual } = generacionControlada();
    const usuario = renderBoton();
    const modal = await abrir(usuario);
    await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
    expect(actual().pedido).toMatchObject({
      filtros: FILTROS,
      modo: 'con-fotos',
      nombreArchivo: 'arboles-san-sebastian-2025-2026-con-foto-id-l23.pdf',
    });
    expect(modal.getByText('Leyendo árboles…')).toBeInTheDocument();
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 37, total: 148 });
    expect(modal.getByText('Bajando fotos: 37 de 148')).toBeInTheDocument();
    actual().progresar({ etapa: ETAPA_REPORTE.armandoPdf });
    expect(modal.getByText('Armando el PDF…')).toBeInTheDocument();
  });

  test('sin fotos fallidas, al terminar cierra el modal', async () => {
    const { actual } = generacionControlada();
    const usuario = renderBoton();
    await usuario.click((await abrir(usuario)).getByRole('button', { name: 'Generar PDF' }));
    await act(async () => actual().terminar());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('con fotos fallidas, al terminar lo avisa y «Listo» cierra', async () => {
    const { actual } = generacionControlada();
    const usuario = renderBoton();
    const modal = await abrir(usuario);
    await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
    await act(async () => actual().terminar(2));
    expect(modal.getByRole('status')).toHaveTextContent('2 fotos no se pudieron bajar');
    await usuario.click(modal.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('si falla, lo dice y deja volver a intentar', async () => {
    const { actual } = generacionControlada();
    const usuario = renderBoton();
    const modal = await abrir(usuario);
    await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
    await act(async () => actual().fallar());
    expect(modal.getByRole('alert')).toHaveTextContent('No se pudo generar el reporte.');
    expect(modal.getByRole('button', { name: 'Generar PDF' })).toBeEnabled();
  });
});

describe('cancelar', () => {
  test.each([
    ['Cancelar', ETAPA_REPORTE.leyendoArboles],
    ['Cancelar', ETAPA_REPORTE.bajandoFotos],
    ['Escape', ETAPA_REPORTE.leyendoArboles],
    ['Escape', ETAPA_REPORTE.bajandoFotos],
  ] as const)('con %s en «%s» corta todo, cierra y no avisa nada', async (como, etapa) => {
    const { actual } = generacionControlada();
    const usuario = renderBoton();
    const modal = await abrir(usuario);
    await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
    if (etapa === ETAPA_REPORTE.bajandoFotos) actual().progresar({ etapa, listas: 3, total: 148 });
    if (como === 'Escape') await usuario.keyboard('{Escape}');
    else await usuario.click(modal.getByRole('button', { name: 'Cancelar' }));
    expect(actual().pedido.senal?.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const otraVez = await abrir(usuario);
    expect(otraVez.queryByRole('alert')).not.toBeInTheDocument();
    expect(otraVez.getByRole('button', { name: 'Generar PDF' })).toBeEnabled();
  });

  test('mientras se arma el PDF no se puede cancelar, ni con Escape', async () => {
    const { actual } = generacionControlada();
    const usuario = renderBoton();
    const modal = await abrir(usuario);
    await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
    actual().progresar({ etapa: ETAPA_REPORTE.armandoPdf });
    expect(modal.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(actual().pedido.senal?.aborted).toBe(false);
  });
});
