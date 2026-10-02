import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ArbolDetalle } from '../../../queries/dataExplorerQueries';
import { ArbolDetallePanel } from '../ArbolDetallePanel';
import { arbolDetalle } from '../../../test/fabricas';
import { obtenerUrlDescargaFoto, obtenerUrlFoto } from '../../../services/fotoService';
import { descargarDesdeUrl } from '../../../services/descargas';

// Leaflet usa APIs de layout que jsdom no implementa.
vi.mock('../../../components/mapa/MapaPuntos', () => ({
  MapaPuntos: () => <div>Mapa del árbol</div>,
}));

vi.mock('../../../services/fotoService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/fotoService')>(
    '../../../services/fotoService',
  );
  return { ...actual, obtenerUrlFoto: vi.fn(), obtenerUrlDescargaFoto: vi.fn() };
});

vi.mock('../../../services/descargas', async () => {
  const actual = await vi.importActual<typeof import('../../../services/descargas')>(
    '../../../services/descargas',
  );
  return { ...actual, descargarDesdeUrl: vi.fn() };
});

function arbol(sobreescritura: Partial<ArbolDetalle> = {}): ArbolDetalle {
  return arbolDetalle({
    subId: 'A-001',
    idArbol: 'A-001-SS26',
    especieCodigo: 'QB',
    especieNombre: 'Quebracho',
    parcelaId: 'par-1',
    grupoId: 'grupo-1',
    grupoCodigo: 'G-01',
    posicion: 3,
    latitude: -27.123456,
    longitude: -55.654321,
    gpsAccuracy: 5,
    fotoUrl: null,
    createdAt: '2026-02-10T12:00:00Z',
    usuarioRegistro: 'user-1',
    ...sobreescritura,
  });
}

/** Un árbol registrado sin GPS: los tres campos vienen ausentes, no en null. */
function arbolSinGps(): ArbolDetalle {
  const { latitude, longitude, gpsAccuracy, ...resto } = arbol();
  void latitude;
  void longitude;
  void gpsAccuracy;
  return resto;
}

function renderPanel(
  datos: ArbolDetalle = arbol(),
  {
    parcelaCodigo = 'P-01' as string | null,
    tecnicoNombre = 'Lucía Ferreyra' as string | null,
  } = {},
) {
  const onCerrar = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ArbolDetallePanel
        arbol={datos}
        parcelaCodigo={parcelaCodigo}
        tecnicoNombre={tecnicoNombre}
        nombreFoto="foto-finca-2026-a-001.jpg"
        onCerrar={onCerrar}
      />
    </QueryClientProvider>,
  );
  return onCerrar;
}

/** Valor del dato de la grilla de metadatos con esa etiqueta. */
function metaDato(etiqueta: string): string | null | undefined {
  return screen.getByText(etiqueta).nextElementSibling?.textContent;
}

test('muestra especie, coordenadas con precisión y los metadatos', () => {
  renderPanel();

  expect(screen.getByRole('heading', { name: 'A-001-SS26' })).toBeInTheDocument();
  expect(screen.getByText('QB · Quebracho')).toBeInTheDocument();
  expect(screen.getByText(/-27\.12346, -55\.65432/)).toBeInTheDocument();
  expect(screen.getByText(/±5m/)).toBeInTheDocument();
  expect(screen.getByText('Mapa del árbol')).toBeInTheDocument();
  expect(screen.getByText('P-01')).toBeInTheDocument();
  expect(screen.getByText('Lucía Ferreyra')).toBeInTheDocument();
});

test('sin GPS avisa en vez de dibujar un mapa en 0,0', () => {
  renderPanel(arbolSinGps());

  expect(screen.getByText('Sin coordenada GPS')).toBeInTheDocument();
  expect(screen.queryByText('Mapa del árbol')).not.toBeInTheDocument();
});

test('sin foto subida lo dice, no deja el bloque vacío', () => {
  renderPanel();
  expect(screen.getByText('Sin foto')).toBeInTheDocument();
});

test('sin especie identificada cae a N/N', () => {
  renderPanel(arbol({ especieCodigo: null, especieNombre: null }));
  expect(screen.getByText('N/N · Sin identificar')).toBeInTheDocument();
});

test('sin técnico, parcela ni posición muestra la raya en cada dato', () => {
  renderPanel(arbol({ usuarioRegistro: null, parcelaId: null, posicion: null }), {
    parcelaCodigo: null,
    tecnicoNombre: null,
  });

  expect(metaDato('Técnico')).toBe('—');
  expect(metaDato('Parcela')).toBe('—');
  expect(metaDato('Posición')).toBe('—');
  expect(metaDato('Grupo')).toBe('G-01');
});

test('GPS sin precisión muestra solo las coordenadas', () => {
  renderPanel(arbol({ gpsAccuracy: undefined }));

  expect(screen.getByText('-27.12346, -55.65432')).toBeInTheDocument();
  expect(screen.queryByText(/±/)).not.toBeInTheDocument();
});

test('la X cierra el panel', async () => {
  const usuario = userEvent.setup();
  const onCerrar = renderPanel();

  await usuario.click(screen.getByRole('button', { name: 'Cerrar Detalle del árbol A-001-SS26' }));
  expect(onCerrar).toHaveBeenCalled();
});

describe('descarga de la foto', () => {
  const FOTO_SUBIDA = 'plantations/p1/trees/t1.jpg';

  beforeEach(() => {
    vi.mocked(descargarDesdeUrl).mockClear();
    vi.mocked(obtenerUrlFoto).mockResolvedValue('https://firmada.test/foto.jpg');
  });

  test('sin foto subida no ofrece descargar', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: 'Descargar' })).not.toBeInTheDocument();
  });

  test('descarga con la URL firmada y el nombre legible', async () => {
    vi.mocked(obtenerUrlDescargaFoto).mockResolvedValue('https://firmada.test/foto.jpg?download=x');
    const usuario = userEvent.setup();
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }));

    await usuario.click(screen.getByRole('button', { name: 'Descargar' }));

    expect(obtenerUrlDescargaFoto).toHaveBeenCalledWith(FOTO_SUBIDA, 'foto-finca-2026-a-001.jpg');
    expect(descargarDesdeUrl).toHaveBeenCalledWith(
      'https://firmada.test/foto.jpg?download=x',
      'foto-finca-2026-a-001.jpg',
    );
  });

  test('si no se puede firmar avisa y no descarga', async () => {
    vi.mocked(obtenerUrlDescargaFoto).mockRejectedValue(new Error('sin red'));
    const usuario = userEvent.setup();
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }));

    await usuario.click(screen.getByRole('button', { name: 'Descargar' }));

    expect(await screen.findByText('No se pudo descargar la foto')).toBeInTheDocument();
    expect(descargarDesdeUrl).not.toHaveBeenCalled();
  });
});
