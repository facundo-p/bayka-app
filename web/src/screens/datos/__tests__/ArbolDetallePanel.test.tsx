import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ArbolDetalle } from '../../../queries/dataExplorerQueries';
import { ArbolDetallePanel } from '../ArbolDetallePanel';
import { arbolDetalle } from '../../../test/fabricas';
import { obtenerUrlDescargaFoto, obtenerUrlFoto } from '../../../services/fotoService';
import { descargarDesdeUrl } from '../../../services/descargas';
import { listarEspeciesDePlantacion } from '../../../queries/especieQueries';
import {
  cambiarEspecieDeArbol,
  ConflictoDeEspecieError,
} from '../../../repositories/especieDeArbol';
import type { EdicionDeEspecie } from '../useCambioDeEspecie';
import { ErrorDeEdicion } from '../../../repositories/edicionDePlantacion';

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

vi.mock('../../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));

vi.mock('../../../repositories/especieDeArbol', async () => {
  const actual = await vi.importActual<typeof import('../../../repositories/especieDeArbol')>(
    '../../../repositories/especieDeArbol',
  );
  return { ...actual, cambiarEspecieDeArbol: vi.fn() };
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
    nombreFoto = 'foto-finca-2026-a-001.jpg' as string | null,
    descargarFicha = null as (() => Promise<void>) | null,
    edicionDeEspecie = undefined as EdicionDeEspecie | undefined,
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
        nombreFoto={nombreFoto}
        descargarFicha={descargarFicha}
        edicionDeEspecie={edicionDeEspecie}
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

describe('ficha PDF (#754)', () => {
  test('el botón está al pie y genera la ficha', async () => {
    const descargarFicha = vi.fn(async () => {});
    renderPanel(arbol(), { descargarFicha });

    await userEvent.click(screen.getByRole('button', { name: 'Descargar ficha PDF' }));

    expect(descargarFicha).toHaveBeenCalledTimes(1);
  });

  test('mientras genera avisa y no acepta otro click', async () => {
    let terminar = () => {};
    const descargarFicha = vi.fn(() => new Promise<void>((resolver) => (terminar = resolver)));
    renderPanel(arbol(), { descargarFicha });

    await userEvent.click(screen.getByRole('button', { name: 'Descargar ficha PDF' }));

    const generando = screen.getByRole('button', { name: /Generando ficha/ });
    expect(generando).toBeDisabled();
    await userEvent.click(generando);
    expect(descargarFicha).toHaveBeenCalledTimes(1);
    terminar();
    expect(await screen.findByRole('button', { name: 'Descargar ficha PDF' })).toBeEnabled();
  });

  test('si falla, lo dice debajo del botón', async () => {
    const descargarFicha = vi.fn(async () => {
      throw new Error('boom');
    });
    renderPanel(arbol(), { descargarFicha });

    await userEvent.click(screen.getByRole('button', { name: 'Descargar ficha PDF' }));

    expect(await screen.findByText('No se pudo generar la ficha')).toBeInTheDocument();
  });

  test('sin la plantación cargada queda deshabilitado', () => {
    renderPanel(arbol(), { descargarFicha: null });
    expect(screen.getByRole('button', { name: 'Descargar ficha PDF' })).toBeDisabled();
  });
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

  test('con la plantación sin cargar el botón está deshabilitado', () => {
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }), { nombreFoto: null });
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeDisabled();
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

describe('cambiar la especie (#679)', () => {
  const ESPECIES = [
    { id: 'sp-qb', codigo: 'QB', nombre: 'Quebracho', nombreCientifico: 'Schinopsis balansae' },
    { id: 'sp-tal', codigo: 'TAL', nombre: 'Tala', nombreCientifico: 'Celtis tala' },
  ];

  function edicion(): EdicionDeEspecie {
    return { plantationId: 'p1', codigoPlantacion: 'SS26', onActualizado: vi.fn() };
  }

  const enlaceCambiar = () => screen.getByRole('button', { name: 'Cambiar la especie' });
  const disparador = () => screen.getByRole('button', { name: /^Especie nueva/ });

  async function elegirTala(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.click(enlaceCambiar());
    await usuario.click(await screen.findByRole('button', { name: /^Especie nueva/ }));
    await usuario.type(screen.getByRole('combobox'), 'celtis');
    await usuario.click(screen.getByRole('option', { name: /TAL · Tala/ }));
  }

  beforeEach(() => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue(ESPECIES);
    vi.mocked(cambiarEspecieDeArbol).mockReset();
    vi.mocked(listarEspeciesDePlantacion).mockClear();
  });

  test('sin permiso no se ofrece', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: 'Cambiar la especie' })).not.toBeInTheDocument();
  });

  test('abre el selector con la especie actual y sin poder guardar', async () => {
    const usuario = userEvent.setup();
    renderPanel(arbol({ especieId: 'sp-qb' }), { edicionDeEspecie: edicion() });

    await usuario.click(enlaceCambiar());

    expect(await screen.findByRole('button', { name: /^Especie nueva/ })).toHaveAccessibleName(
      /QB · Quebracho/,
    );
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(listarEspeciesDePlantacion).toHaveBeenCalledWith('p1');
  });

  test('guardar manda la base y deja el árbol con la especie y el ID nuevos', async () => {
    const usuario = userEvent.setup();
    const edicionDeEspecie = edicion();
    vi.mocked(cambiarEspecieDeArbol).mockResolvedValue('P01G01TAL3');
    renderPanel(arbol({ especieId: 'sp-qb' }), { edicionDeEspecie });

    await elegirTala(usuario);
    expect(disparador()).toHaveAccessibleName(/TAL · Tala/);
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(cambiarEspecieDeArbol).toHaveBeenCalledWith(arbol().id, 'sp-tal', 'sp-qb');
    await vi.waitFor(() =>
      expect(edicionDeEspecie.onActualizado).toHaveBeenCalledWith(
        expect.objectContaining({
          especieId: 'sp-tal',
          especieCodigo: 'TAL',
          especieNombre: 'Tala',
          subId: 'P01G01TAL3',
          idArbol: 'P01G01TAL3-SS26',
        }),
      ),
    );
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  test('si alguien la cambió desde otro lado avisa y muestra la del server', async () => {
    const usuario = userEvent.setup();
    const edicionDeEspecie = edicion();
    vi.mocked(cambiarEspecieDeArbol).mockRejectedValue(
      new ConflictoDeEspecieError({
        especieId: 'sp-cei',
        especieCodigo: 'CEI',
        especieNombre: 'Ceibo',
        subId: 'P01G01CEI3',
      }),
    );
    renderPanel(arbol({ especieId: 'sp-qb' }), { edicionDeEspecie });

    await elegirTala(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ahora es Ceibo/);
    expect(edicionDeEspecie.onActualizado).toHaveBeenCalledWith(
      expect.objectContaining({ especieId: 'sp-cei', idArbol: 'P01G01CEI3-SS26' }),
    );
  });

  test('si la especie ya no estaba habilitada, avisa y vuelve a leer las opciones', async () => {
    const usuario = userEvent.setup();
    vi.mocked(cambiarEspecieDeArbol).mockRejectedValue(
      new ErrorDeEdicion('Esa especie ya no está habilitada en la plantación.'),
    );
    renderPanel(arbol({ especieId: 'sp-qb' }), { edicionDeEspecie: edicion() });

    await elegirTala(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya no está habilitada/);
    await vi.waitFor(() => expect(listarEspeciesDePlantacion).toHaveBeenCalledTimes(2));
  });

  test('cancelar cierra sin guardar', async () => {
    const usuario = userEvent.setup();
    renderPanel(arbol({ especieId: 'sp-qb' }), { edicionDeEspecie: edicion() });

    await elegirTala(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(cambiarEspecieDeArbol).not.toHaveBeenCalled();
    expect(enlaceCambiar()).toBeInTheDocument();
  });
});
