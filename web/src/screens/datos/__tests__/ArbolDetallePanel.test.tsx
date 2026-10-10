import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ArbolDetalle } from '../../../queries/dataExplorerQueries';
import type { CodigoNombre } from '../../../queries/fichasQueries';
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
    especieId: 'sp-qb',
    especieCodigo: 'QB',
    especieNombre: 'Quebracho',
    especieNombreCientifico: 'Schinopsis balansae',
    parcelaId: 'par-1',
    grupoId: 'grupo-1',
    grupoCodigo: 'G-01',
    grupoNombre: 'Línea 1',
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

const NN = {
  especieId: null,
  especieCodigo: null,
  especieNombre: null,
  especieNombreCientifico: null,
};

function renderPanel(
  datos: ArbolDetalle = arbol(),
  {
    parcela = { codigo: 'P-01', nombre: 'Loma Norte' } as CodigoNombre | null,
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
        parcela={parcela}
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

/** Los `dd` de la celda de ubicación con ese `dt`. */
function ubicacion(etiqueta: string): string[] {
  const termino = screen.getByText(etiqueta, { selector: 'dt' });
  return [...termino.parentElement!.querySelectorAll('dd')].map((dd) => dd.textContent ?? '');
}

test('muestra la especie con su código, el científico y el GPS con precisión', () => {
  renderPanel();

  expect(screen.getByRole('heading', { name: 'A-001-SS26' })).toBeInTheDocument();
  expect(screen.getByText('Quebracho')).toBeInTheDocument();
  expect(screen.getByText('QB')).toBeInTheDocument();
  expect(screen.getByText('Schinopsis balansae')).toBeInTheDocument();
  expect(screen.getByText('-27.123456, -55.654321')).toBeInTheDocument();
  expect(screen.getByText('± 5 m')).toBeInTheDocument();
  expect(screen.getByText('Mapa del árbol')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/search/?api=1&query=-27.123456,-55.654321',
  );
});

describe('ubicación (#830)', () => {
  test('parcela, grupo y posición van en una lista de dt/dd con código y nombre', () => {
    renderPanel();

    expect(screen.getByText('Parcela', { selector: 'dt' }).closest('dl')).not.toBeNull();
    expect(ubicacion('Parcela')).toEqual(['P-01', 'Loma Norte']);
    expect(ubicacion('Grupo')).toEqual(['G-01', 'Línea 1']);
    expect(ubicacion('Posición')).toEqual(['3']);
  });

  test('sin parcela ni posición muestra la raya, sin nombre debajo', () => {
    renderPanel(arbol({ parcelaId: null, posicion: null, grupoNombre: null }), { parcela: null });

    expect(ubicacion('Parcela')).toEqual(['—']);
    expect(ubicacion('Grupo')).toEqual(['G-01']);
    expect(ubicacion('Posición')).toEqual(['—']);
  });
});

test('el registro dice cuándo y quién, con la raya si no se sabe quién', () => {
  renderPanel(arbol(), { tecnicoNombre: null });
  expect(screen.getByText(/Registrado el/)).toHaveTextContent('Registrado el 10/02/2026 por —');
});

test('sin GPS avisa en vez de dibujar un mapa en 0,0', () => {
  renderPanel(arbolSinGps());

  expect(screen.getByText('Sin punto GPS')).toBeInTheDocument();
  expect(screen.queryByText('Mapa del árbol')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Google Maps' })).not.toBeInTheDocument();
});

test('GPS sin precisión muestra solo las coordenadas', () => {
  renderPanel(arbol({ gpsAccuracy: undefined }));

  expect(screen.getByText('-27.123456, -55.654321')).toBeInTheDocument();
  expect(screen.queryByText(/±/)).not.toBeInTheDocument();
});

describe('copiar al portapapeles', () => {
  test('copia el ID Árbol y lo confirma', async () => {
    const usuario = userEvent.setup();
    renderPanel();

    await usuario.click(screen.getByRole('button', { name: 'Copiar ID Árbol' }));

    expect(await navigator.clipboard.readText()).toBe('A-001-SS26');
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  test('copia las coordenadas', async () => {
    const usuario = userEvent.setup();
    renderPanel();

    await usuario.click(screen.getByRole('button', { name: 'Copiar coordenadas' }));

    expect(await navigator.clipboard.readText()).toBe('-27.123456, -55.654321');
  });
});

describe('especie N/N', () => {
  test('se marca sin identificar y no ofrece acción sin permiso', () => {
    renderPanel(arbol(NN));

    expect(screen.getByText('Sin identificar')).toBeInTheDocument();
    expect(screen.getByText('N/N')).toBeInTheDocument();
    expect(screen.getByText('Falta identificar la especie')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Identificar la especie' })).toBeNull();
  });

  test('con permiso, «Identificar» abre el mismo selector que «Cambiar»', async () => {
    vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([]);
    const usuario = userEvent.setup();
    const edicionDeEspecie = {
      plantationId: 'p1',
      codigoPlantacion: 'SS26',
      onActualizado: vi.fn(),
    };
    renderPanel(arbol(NN), { edicionDeEspecie });

    expect(screen.queryByRole('button', { name: 'Cambiar la especie' })).toBeNull();
    await usuario.click(screen.getByRole('button', { name: 'Identificar la especie' }));

    expect(await screen.findByRole('button', { name: /^Especie nueva/ })).toBeInTheDocument();
  });
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

describe('foto', () => {
  const FOTO_SUBIDA = 'plantations/p1/trees/t1.jpg';
  const FOTO_FIRMADA = 'https://firmada.test/foto.jpg';
  const descargarFoto = () => screen.findByRole('button', { name: 'Descargar foto' });

  beforeEach(() => {
    vi.mocked(descargarDesdeUrl).mockClear();
    vi.mocked(obtenerUrlFoto).mockReset();
    vi.mocked(obtenerUrlFoto).mockResolvedValue(FOTO_FIRMADA);
  });

  test('sin foto lo dice y no ofrece descargar', () => {
    renderPanel();
    expect(screen.getByText('Sin foto')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar foto' })).not.toBeInTheDocument();
  });

  test.each(['file:///data/foto.jpg', 'content://media/foto.jpg'])(
    'una foto que sigue en el celular (%s) no se confunde con «Sin foto»',
    (fotoUrl) => {
      renderPanel(arbol({ fotoUrl }));

      expect(screen.getByText('Foto sin subir')).toBeInTheDocument();
      expect(screen.getByText(/Sigue en el celular/)).toBeInTheDocument();
      expect(screen.queryByText('Sin foto')).not.toBeInTheDocument();
      expect(obtenerUrlFoto).not.toHaveBeenCalled();
    },
  );

  test('subida, el click la abre entera en un modal', async () => {
    const usuario = userEvent.setup();
    const onCerrar = renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }));

    await usuario.click(await screen.findByRole('button', { name: 'Ampliar foto' }));

    const modal = screen.getByRole('dialog', { name: 'Foto del árbol A-001-SS26' });
    expect(within(modal).getByRole('img')).toHaveAttribute('src', FOTO_FIRMADA);
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // El Escape cierra el modal, no el panel de atrás.
    expect(onCerrar).not.toHaveBeenCalled();
  });

  test('el modal también cierra con su botón', async () => {
    const usuario = userEvent.setup();
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }));

    await usuario.click(await screen.findByRole('button', { name: 'Ampliar foto' }));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('si no se puede firmar, lo dice', async () => {
    vi.mocked(obtenerUrlFoto).mockResolvedValue(null);
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }));
    expect(await screen.findByText('No se pudo cargar la foto')).toBeInTheDocument();
  });

  test('descarga con la URL firmada y el nombre legible', async () => {
    vi.mocked(obtenerUrlDescargaFoto).mockResolvedValue('https://firmada.test/foto.jpg?download=x');
    const usuario = userEvent.setup();
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }));

    await usuario.click(await descargarFoto());

    expect(obtenerUrlDescargaFoto).toHaveBeenCalledWith(FOTO_SUBIDA, 'foto-finca-2026-a-001.jpg');
    expect(descargarDesdeUrl).toHaveBeenCalledWith(
      'https://firmada.test/foto.jpg?download=x',
      'foto-finca-2026-a-001.jpg',
    );
  });

  test('con la plantación sin cargar el botón está deshabilitado', async () => {
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }), { nombreFoto: null });
    expect(await descargarFoto()).toBeDisabled();
  });

  test('si no se puede firmar la descarga avisa y no descarga', async () => {
    vi.mocked(obtenerUrlDescargaFoto).mockRejectedValue(new Error('sin red'));
    const usuario = userEvent.setup();
    renderPanel(arbol({ fotoUrl: FOTO_SUBIDA }));

    await usuario.click(await descargarFoto());

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
          especieNombreCientifico: 'Celtis tala',
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
        especieNombreCientifico: null,
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
