import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { contarArbolesDelFiltro, type FiltrosArboles } from '../../../queries/dataExplorerQueries';
import {
  descargarReportePdf,
  ETAPA_REPORTE,
  type PedidoDescargaReporte,
  type ProgresoReporte,
} from '../../../services/pdfReporte';
import { plantacion } from '../../../test/fabricas';
import { BotonReportePdf } from '../BotonReportePdf';
import { ReportePdfModal } from '../ReportePdfModal';
import { useReportePdf, type ReportePdfProps } from '../useReportePdf';

vi.mock('../../../queries/dataExplorerQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../queries/dataExplorerQueries')>()),
  contarArbolesDelFiltro: vi.fn(),
}));
vi.mock('../../../services/pdfReporte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/pdfReporte')>()),
  descargarReportePdf: vi.fn(),
}));
vi.mock('../../../pdf/plantilla/textoLargo', () => ({ CORTAR_TEXTO_LARGO: false }));

const PLANTACION = plantacion({ id: 'plant-1', lugar: 'San Sebastián', periodo: '2025-2026' });
const FILTROS: FiltrosArboles = { conFoto: true, busqueda: 'L23' };
const CATALOGOS = { parcelas: [], grupos: [], especies: [] };

type Generacion = {
  pedido: PedidoDescargaReporte;
  progresar: (progreso: ProgresoReporte) => void;
  terminar: (fotosFallidas?: number) => void;
  fallar: () => void;
};

/**
 * La descarga queda abierta hasta que el test la termina. Como la real, avisa la
 * lectura al arrancar y, abortada, rechaza.
 */
function generacionControlada(): { actual: () => Generacion } {
  let actual: Generacion | null = null;
  vi.mocked(descargarReportePdf).mockImplementation((pedido) => {
    pedido.alProgresar?.({ etapa: ETAPA_REPORTE.leyendoArboles });
    return new Promise((resolve, reject) => {
      pedido.senal?.addEventListener('abort', () => reject(pedido.senal?.reason));
      actual = {
        pedido,
        progresar: (progreso) => act(() => pedido.alProgresar?.(progreso)),
        terminar: (fotosFallidas = 0) => resolve({ fotosFallidas }),
        fallar: () => reject(new Error('sin red')),
      };
    });
  });
  return { actual: () => actual! };
}

/** Como en la sección de Árboles: el botón y el modal comparten el estado del hook. */
function Reporte(props: ReportePdfProps) {
  const reporte = useReportePdf(props);
  return (
    <>
      <BotonReportePdf reporte={reporte} />
      <ReportePdfModal reporte={reporte} />
    </>
  );
}

const PROPS: ReportePdfProps = {
  plantacion: PLANTACION,
  filtros: FILTROS,
  catalogos: CATALOGOS,
  hayArboles: true,
};

function ConQueryClient({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderReporte(props: Partial<ReportePdfProps> = {}) {
  render(<Reporte {...PROPS} {...props} />, { wrapper: ConQueryClient });
  return userEvent.setup();
}

const dialogo = () => screen.getByRole('dialog', { name: 'Reporte PDF de árboles' });

async function abrir(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('button', { name: 'Reporte PDF' }));
  await within(dialogo()).findByText(/en el filtro/);
  return within(dialogo());
}

async function generar(usuario: ReturnType<typeof userEvent.setup>) {
  const modal = await abrir(usuario);
  await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
  return modal;
}

const opcion = (modal: ReturnType<typeof within>, nombre: RegExp) =>
  modal.getByRole('radio', { name: nombre });

/** La región viva del modal: la primera, antes del contenido de cada fase. */
const anuncio = (modal: ReturnType<typeof within>) => modal.getAllByRole('status')[0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 7124, conFoto: 148 });
});

afterEach(() => vi.restoreAllMocks());

describe('el botón', () => {
  test('sin árboles en el filtro queda deshabilitado', () => {
    renderReporte({ hayArboles: false });
    expect(screen.getByRole('button', { name: 'Reporte PDF' })).toBeDisabled();
  });

  test('sin la plantación cargada queda deshabilitado y no cuenta nada', () => {
    renderReporte({ plantacion: null });
    expect(screen.getByRole('button', { name: 'Reporte PDF' })).toBeDisabled();
    expect(contarArbolesDelFiltro).not.toHaveBeenCalled();
  });

  test('sin la plantación, generar no arranca nada aunque lo llamen', () => {
    const { result } = renderHook(() => useReportePdf({ ...PROPS, plantacion: null }), {
      wrapper: ConQueryClient,
    });
    act(() => result.current.generar());
    expect(descargarReportePdf).not.toHaveBeenCalled();
  });
});

describe('al abrir', () => {
  test('cuenta los árboles del filtro y estima hojas y peso de cada modo', async () => {
    const modal = await abrir(renderReporte());
    expect(contarArbolesDelFiltro).toHaveBeenCalledWith('plant-1', FILTROS);
    expect(modal.getByText('7.124 árboles en el filtro, 148 con foto.')).toBeInTheDocument();
    expect(opcion(modal, /Con fotos/)).toHaveAccessibleName('Con fotos 148 tarjetas con foto');
    expect(modal.getByText(/^251 hojas o más · ≈ 11 MB$/)).toBeInTheDocument();
    await userEvent.setup().click(opcion(modal, /Sin fotos/));
    expect(modal.getByText(/^230 hojas o más · ≈ 1,4 MB$/)).toBeInTheDocument();
  });

  test('sin árboles con foto, «Con fotos» queda apagado y dice por qué', async () => {
    vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 50, conFoto: 0 });
    const modal = await abrir(renderReporte());
    expect(opcion(modal, /Con fotos/)).toBeDisabled();
    expect(opcion(modal, /Con fotos/)).toHaveAccessibleName('Con fotos Ningún árbol con foto');
    expect(opcion(modal, /Sin fotos/)).toBeChecked();
  });

  test('pasado el tope de tarjetas, avisa cuántas van al listado; sin fotos, no', async () => {
    vi.mocked(contarArbolesDelFiltro).mockResolvedValue({ total: 900, conFoto: 512 });
    const usuario = renderReporte();
    const modal = await abrir(usuario);
    expect(modal.getByText(/Los otros 112 van al listado, sin foto\.$/)).toBeInTheDocument();
    await usuario.click(opcion(modal, /Sin fotos/));
    expect(modal.queryByText(/van al listado/)).not.toBeInTheDocument();
  });

  test('si el conteo falla, se puede reintentar', async () => {
    vi.mocked(contarArbolesDelFiltro).mockRejectedValueOnce(new Error('sin red'));
    const usuario = renderReporte();
    await usuario.click(screen.getByRole('button', { name: 'Reporte PDF' }));
    const modal = within(dialogo());
    expect(await modal.findByText('No se pudieron contar los árboles.')).toBeInTheDocument();
    expect(modal.getByRole('button', { name: 'Generar PDF' })).toBeDisabled();
    await usuario.click(modal.getByRole('button', { name: 'Reintentar' }));
    expect(await modal.findByText(/en el filtro/)).toBeInTheDocument();
  });
});

describe('al generar', () => {
  test('pide el reporte con el filtro, el modo y el nombre, y muestra cada etapa', async () => {
    const { actual } = generacionControlada();
    const modal = await generar(renderReporte());
    expect(actual().pedido).toMatchObject({
      filtros: FILTROS,
      modo: 'con-fotos',
      nombreArchivo: 'arboles-san-sebastian-2025-2026-con-foto-id-l23.pdf',
    });
    expect(modal.getByText('Leyendo árboles…', { selector: 'p:not([role])' })).toBeInTheDocument();
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 37, total: 148 });
    expect(modal.getByText('Bajando fotos: 37 de 148')).toBeInTheDocument();
    expect(modal.getByRole('progressbar', { name: 'Fotos bajadas' })).toHaveAttribute(
      'aria-valuenow',
      '25',
    );
    actual().progresar({ etapa: ETAPA_REPORTE.armandoPdf });
    expect(modal.getByText('Armando el PDF…', { selector: 'p:not([role])' })).toBeInTheDocument();
  });

  test('un doble clic en «Generar PDF» lanza una sola corrida', async () => {
    generacionControlada();
    const usuario = renderReporte();
    const modal = await abrir(usuario);
    await usuario.dblClick(modal.getByRole('button', { name: 'Generar PDF' }));
    expect(descargarReportePdf).toHaveBeenCalledOnce();
  });

  test('si el segundo clic llega antes de que cambie la fase, corta la primera corrida', async () => {
    const senales: AbortSignal[] = [];
    vi.mocked(descargarReportePdf).mockImplementation(({ senal }) => {
      senales.push(senal!);
      return new Promise(() => {});
    });
    const usuario = renderReporte();
    const modal = await abrir(usuario);
    await usuario.dblClick(modal.getByRole('button', { name: 'Generar PDF' }));
    expect(senales.map((senal) => senal.aborted)).toEqual([true, false]);
  });

  test('sin fotos fallidas, al terminar cierra el modal', async () => {
    const { actual } = generacionControlada();
    await generar(renderReporte());
    await act(async () => actual().terminar());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('con fotos fallidas, al terminar lo avisa y «Listo» cierra', async () => {
    const { actual } = generacionControlada();
    const usuario = renderReporte();
    const modal = await generar(usuario);
    await act(async () => actual().terminar(2));
    expect(
      modal.getByText(/2 fotos no se pudieron bajar/, { selector: 'p:not([role])' }),
    ).toBeInTheDocument();
    await usuario.click(modal.getByRole('button', { name: 'Listo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('si falla, lo dice, deja rastro en la consola y deja volver a intentar', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { actual } = generacionControlada();
    const modal = await generar(renderReporte());
    await act(async () => actual().fallar());
    expect(modal.getByRole('alert')).toHaveTextContent('No se pudo generar el reporte.');
    expect(modal.getByRole('button', { name: 'Generar PDF' })).toBeEnabled();
    expect(consola).toHaveBeenCalledWith(new Error('sin red'));
  });

  test('reintentar después de un error arranca una corrida nueva', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { actual } = generacionControlada();
    const usuario = renderReporte();
    const modal = await generar(usuario);
    const primera = actual().pedido.senal;
    await act(async () => actual().fallar());
    await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
    expect(descargarReportePdf).toHaveBeenCalledTimes(2);
    expect(actual().pedido.senal).not.toBe(primera);
    expect(actual().pedido.senal?.aborted).toBe(false);
    expect(modal.queryByRole('alert')).not.toBeInTheDocument();
    expect(modal.getByText('Leyendo árboles…', { selector: 'p:not([role])' })).toBeInTheDocument();
  });

  test('mientras genera, un clic en el fondo no cierra ni corta nada', async () => {
    const { actual } = generacionControlada();
    const usuario = renderReporte();
    await generar(usuario);
    await usuario.click(dialogo().parentElement!);
    expect(dialogo()).toBeInTheDocument();
    expect(actual().pedido.senal?.aborted).toBe(false);
  });

  test('eligiendo, un clic en el fondo cierra como siempre', async () => {
    const usuario = renderReporte();
    await abrir(usuario);
    await usuario.click(dialogo().parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('accesibilidad', () => {
  test('al cambiar de fase el foco queda en el modal, no en el body', async () => {
    const { actual } = generacionControlada();
    const modal = await generar(renderReporte());
    expect(dialogo()).toContainElement(document.activeElement as HTMLElement);
    await act(async () => actual().terminar(1));
    expect(modal.getByRole('button', { name: 'Listo' })).toBeInTheDocument();
    expect(dialogo()).toContainElement(document.activeElement as HTMLElement);
  });

  test('dentro de una misma fase el foco no se mueve: el avance de las fotos no lo roba', async () => {
    const { actual } = generacionControlada();
    const modal = await generar(renderReporte());
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 1, total: 148 });
    const cancelar = modal.getByRole('button', { name: 'Cancelar' });
    act(() => cancelar.focus());
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 2, total: 148 });
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 3, total: 148 });
    expect(cancelar).toHaveFocus();
  });

  test('la región viva está desde que abre y anuncia cada etapa, no cada foto', async () => {
    const { actual } = generacionControlada();
    const usuario = renderReporte();
    const modal = await abrir(usuario);
    const region = anuncio(modal);
    expect(region).toHaveTextContent(/^$/);
    await usuario.click(modal.getByRole('button', { name: 'Generar PDF' }));
    expect(anuncio(modal)).toBe(region);
    expect(region).toHaveTextContent(/^Leyendo árboles…$/);
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 1, total: 148 });
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 2, total: 148 });
    expect(region).toHaveTextContent(/^Bajando fotos…$/);
    actual().progresar({ etapa: ETAPA_REPORTE.armandoPdf });
    expect(region).toHaveTextContent(/^Armando el PDF…$/);
  });

  test('la misma región anuncia las fotos fallidas, y nadie más las anuncia', async () => {
    const { actual } = generacionControlada();
    const modal = await generar(renderReporte());
    const region = anuncio(modal);
    await act(async () => actual().terminar(2));
    expect(anuncio(modal)).toBe(region);
    expect(region).toHaveTextContent(/2 fotos no se pudieron bajar/);
    const queLoAnuncian = modal
      .getAllByRole('status')
      .filter((otra) => /no se pudieron bajar/.test(otra.textContent ?? ''));
    expect(queLoAnuncian).toEqual([region]);
  });
});

describe('cancelar', () => {
  const etapas = [
    { etapa: ETAPA_REPORTE.leyendoArboles },
    { etapa: ETAPA_REPORTE.bajandoFotos, listas: 3, total: 148 },
    { etapa: ETAPA_REPORTE.armandoPdf },
  ] as const;

  test.each(
    etapas.flatMap((progreso) => [
      ['Cancelar', progreso],
      ['Escape', progreso],
    ]),
  )('con %s en %o corta todo, cierra y no avisa nada', async (como, progreso) => {
    const consola = vi.spyOn(console, 'error');
    const { actual } = generacionControlada();
    const usuario = renderReporte();
    const modal = await generar(usuario);
    actual().progresar(progreso);
    if (como === 'Escape') await usuario.keyboard('{Escape}');
    else await usuario.click(modal.getByRole('button', { name: 'Cancelar' }));
    expect(actual().pedido.senal?.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Una foto que ya venía bajando avisa su avance después de cancelar.
    actual().progresar({ etapa: ETAPA_REPORTE.bajandoFotos, listas: 4, total: 148 });
    const otraVez = await abrir(usuario);
    expect(otraVez.queryByRole('alert')).not.toBeInTheDocument();
    expect(otraVez.getByRole('button', { name: 'Generar PDF' })).toBeEnabled();
    expect(consola).not.toHaveBeenCalled();
  });
});
