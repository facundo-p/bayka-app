import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { prepararSesionAdmin } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

// Leaflet usa APIs de layout que jsdom no implementa: el mapa del detalle se
// reemplaza por un contenedor tonto. El mapa real se valida en el navegador.
vi.mock('../../components/mapa/MapaPuntos', () => ({
  MapaPuntos: () => <div>Mapa del árbol</div>,
}));

const FILA_PLANTACION = {
  id: 'plant-1',
  lugar: 'Mendoza',
  periodo: '2025-2026',
  estado: 'activa',
  created_at: '2026-06-12T12:00:00Z',
  visible_in_app: true,
};

const FILA_PARCELA = {
  id: 'parc-1',
  nombre: 'Norte',
  codigo: 'P1',
  descripcion: 'Lindante al arroyo',
  created_at: '2026-06-01T12:00:00Z',
};

const FILAS_GRUPOS = [
  {
    id: 'gr-1',
    nombre: 'Línea 1',
    codigo: 'L1',
    tipo: 'linea',
    estado: 'activa',
    parcela_id: 'parc-1',
    created_at: '2026-06-02T12:00:00Z',
    parcelas: { codigo: 'P1' },
  },
  {
    id: 'gr-2',
    nombre: 'Bosquete 1',
    codigo: 'B1',
    tipo: 'bosquete',
    estado: 'finalizada',
    parcela_id: 'parc-1',
    created_at: '2026-06-02T13:00:00Z',
    parcelas: { codigo: 'P1' },
  },
];

/** Árbol completo: especie, GPS, foto subida. */
const ARBOL_COMPLETO = {
  id: 'tree-1',
  sub_id: 'A-001',
  posicion: 3,
  group_id: 'gr-1',
  species_id: 'sp-1',
  foto_url: 'plantations/p1/trees/tree-1.jpg',
  usuario_registro: 'user-9',
  created_at: '2026-06-03T12:00:00Z',
  latitude: -27.123456,
  longitude: -55.654321,
  gps_accuracy: 4.6,
  gps_captured_at: '2026-06-03T12:00:05Z',
  species: { codigo: 'QB', nombre: 'Quebracho' },
  groups: { codigo: 'L1', parcela_id: 'parc-1', plantation_id: 'plant-1' },
};

/** Árbol sin identificar, sin GPS y con foto local (no subida). */
const ARBOL_SIN_DATOS = {
  ...ARBOL_COMPLETO,
  id: 'tree-2',
  sub_id: 'A-002',
  species_id: null,
  species: null,
  foto_url: 'file:///data/foto.jpg',
  latitude: null,
  longitude: null,
  gps_accuracy: null,
  gps_captured_at: null,
};

const CATALOGO = [{ id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombre_cientifico: null }];
const PERFILES = [{ id: 'user-9', nombre: 'Teo Técnico', rol: 'tecnico' }];

let consultas: ConsultaCapturada[];

function resolverTrees(consulta: ConsultaCapturada): RespuestaMock {
  // Count head por parcela (stats de la sección Parcelas).
  if (consulta.opciones?.head) return { count: 10 };
  // Lectura de group_id para los counts por grupo de la sección Grupos.
  if (consulta.columnas?.startsWith('group_id')) {
    return { data: [{ group_id: 'gr-1' }, { group_id: 'gr-1' }] };
  }
  // Listado paginado de la sección Árboles.
  return { data: [ARBOL_COMPLETO, ARBOL_SIN_DATOS], count: 120 };
}

function resolver(consulta: ConsultaCapturada): RespuestaMock {
  if (consulta.tabla === 'plantations') return { data: FILA_PLANTACION };
  if (consulta.tabla === 'parcelas') return { data: [FILA_PARCELA] };
  if (consulta.tabla === 'groups') {
    return consulta.opciones?.head ? { count: 4 } : { data: FILAS_GRUPOS };
  }
  if (consulta.tabla === 'trees') return resolverTrees(consulta);
  if (consulta.tabla === 'species') return { data: CATALOGO };
  if (consulta.tabla === 'profiles') return { data: PERFILES };
  return { data: [], count: 0 };
}

beforeEach(() => {
  prepararSesionAdmin();
  consultas = capturarConsultas(resolver);
});

function filaDe(nombreCelda: string): HTMLElement {
  const fila = screen.getByRole('cell', { name: nombreCelda }).closest('tr');
  if (!fila) throw new Error(`No se encontró la fila de ${nombreCelda}`);
  return fila;
}

/** Consultas del listado paginado de árboles (excluye counts y group_id). */
function consultasListaArboles(): ConsultaCapturada[] {
  return consultas.filter(
    (consulta) =>
      consulta.tabla === 'trees' &&
      !consulta.opciones?.head &&
      Boolean(consulta.columnas?.startsWith('*')),
  );
}

describe('sección Parcelas', () => {
  test('lista parcelas con counts y muestra el selector de sección', async () => {
    renderRutasEn('/plantaciones/plant-1/datos/parcelas');

    expect(await screen.findByRole('cell', { name: 'Norte' })).toBeInTheDocument();
    const fila = filaDe('Norte');
    expect(within(fila).getByRole('cell', { name: 'P1' })).toBeInTheDocument();
    expect(within(fila).getByRole('cell', { name: '4' })).toBeInTheDocument();
    expect(within(fila).getByRole('cell', { name: '10' })).toBeInTheDocument();
    // El selector de sección (toolbar única) reemplaza a los sub-tabs.
    expect(screen.getByRole('radio', { name: 'Grupos' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Árboles' })).toBeInTheDocument();
  });

  test('la tab Datos redirige a Parcelas por defecto', async () => {
    renderRutasEn('/plantaciones/plant-1/datos');
    // Parcelas es la sección por defecto: su parcela "Norte" confirma el redirect.
    expect(await screen.findByRole('cell', { name: 'Norte' })).toBeInTheDocument();
  });
});

describe('sección Grupos', () => {
  test('lista grupos con parcela, estado y count de árboles agregado en cliente', async () => {
    renderRutasEn('/plantaciones/plant-1/datos/grupos');

    expect(await screen.findByRole('cell', { name: 'Línea 1' })).toBeInTheDocument();
    const filaLinea = filaDe('Línea 1');
    expect(within(filaLinea).getByText('Activa')).toBeInTheDocument();
    expect(within(filaLinea).getByRole('cell', { name: '2' })).toBeInTheDocument();
    expect(within(filaDe('Bosquete 1')).getByText('Finalizada')).toBeInTheDocument();
    expect(within(filaDe('Bosquete 1')).getByRole('cell', { name: '0' })).toBeInTheDocument();
  });

  test('el filtro por parcela se aplica server-side', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/grupos');
    await screen.findByRole('cell', { name: 'Línea 1' });

    await usuario.selectOptions(await screen.findByLabelText('Parcela'), 'parc-1');

    await screen.findByRole('cell', { name: 'Línea 1' });
    const ultimaDeGrupos = consultas
      .filter((consulta) => consulta.tabla === 'groups' && !consulta.opciones?.head)
      .at(-1);
    expect(ultimaDeGrupos?.filtros).toContainEqual({
      metodo: 'eq',
      columna: 'parcela_id',
      valor: 'parc-1',
    });
  });
});

describe('sección Árboles', () => {
  test('muestra "N/N · Sin identificar" sin especie y deja el GPS sin coordenadas', async () => {
    renderRutasEn('/plantaciones/plant-1/datos/arboles');

    expect(await screen.findByRole('cell', { name: 'A-001' })).toBeInTheDocument();
    const filaCompleta = filaDe('A-001');
    expect(within(filaCompleta).getByText('QB · Quebracho')).toBeInTheDocument();
    expect(within(filaCompleta).getByText(/-27\.12346, -55\.65432/)).toBeInTheDocument();
    expect(within(filaCompleta).getByText(/±5m/)).toBeInTheDocument();
    expect(within(filaCompleta).getByText('Teo Técnico')).toBeInTheDocument();
    // Foto subida → check no interactivo (la foto se ve en el detalle de la fila).
    expect(within(filaCompleta).getByLabelText('Con foto')).toBeInTheDocument();

    const filaVacia = filaDe('A-002');
    expect(within(filaVacia).getByText('N/N · Sin identificar')).toBeInTheDocument();
    // Sin coordenadas la celda GPS muestra "—" (nunca "0,0").
    expect(within(filaVacia).queryByText(/-?\d+\.\d{5}/)).not.toBeInTheDocument();
    // La foto local de mobile no cuenta como subida: sin indicador de foto.
    expect(within(filaVacia).queryByLabelText('Con foto')).not.toBeInTheDocument();
  });

  test('el filtro por especie aplica eq server-side (y N/N aplica is null)', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.selectOptions(screen.getByLabelText('Especie'), 'sp-1');
    await screen.findByRole('cell', { name: 'A-001' });
    expect(consultasListaArboles().at(-1)?.filtros).toContainEqual({
      metodo: 'eq',
      columna: 'species_id',
      valor: 'sp-1',
    });

    await usuario.selectOptions(screen.getByLabelText('Especie'), 'NN');
    await screen.findByRole('cell', { name: 'A-001' });
    expect(consultasListaArboles().at(-1)?.filtros).toContainEqual({
      metodo: 'is',
      columna: 'species_id',
      valor: null,
    });
  });

  test('el filtro de Grupo arranca deshabilitado y se puebla al elegir parcela', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    // Un grupo solo acota dentro de una parcela: sin parcela no hay qué listar.
    const grupo = screen.getByLabelText('Grupo');
    expect(grupo).toBeDisabled();

    await usuario.selectOptions(screen.getByLabelText('Parcela'), 'parc-1');
    await waitFor(() => expect(screen.getByLabelText('Grupo')).toBeEnabled());
    expect(within(screen.getByLabelText('Grupo')).getByRole('option', { name: 'L1' }))
      .toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText('Grupo'), 'gr-1');
    await screen.findByRole('cell', { name: 'A-001' });
    expect(consultasListaArboles().at(-1)?.filtros).toContainEqual({
      metodo: 'eq',
      columna: 'group_id',
      valor: 'gr-1',
    });
  });

  test('llegar desde Grupos deja los dos selects con el scope heredado', async () => {
    renderRutasEn('/plantaciones/plant-1/datos/arboles?parcela=parc-1&grupo=gr-1');
    await screen.findByRole('cell', { name: 'A-001' });

    expect(screen.getByLabelText('Parcela')).toHaveValue('parc-1');
    const grupo = screen.getByLabelText('Grupo');
    expect(grupo).toBeEnabled();
    expect(grupo).toHaveValue('gr-1');
    // Los chips de scope los reemplazan estos dos selects.
    expect(screen.queryByLabelText(/^Quitar /)).not.toBeInTheDocument();
  });

  test('una parcela de la URL que no existe se resetea a todas', async () => {
    renderRutasEn('/plantaciones/plant-1/datos/arboles?parcela=parc-fantasma');
    await screen.findByRole('cell', { name: 'A-001' });

    // Con la parcela fantasma el grupo quedaría habilitado y la tabla filtrada por ella.
    await waitFor(() => expect(screen.getByLabelText('Grupo')).toBeDisabled());
    expect(consultasListaArboles().at(-1)?.filtros).not.toContainEqual(
      expect.objectContaining({ columna: 'groups.parcela_id' }),
    );
  });

  test('cambiar de parcela resetea el grupo', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles?parcela=parc-1&grupo=gr-1');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.selectOptions(screen.getByLabelText('Parcela'), '');
    await waitFor(() => expect(screen.getByLabelText('Grupo')).toHaveValue(''));
    expect(consultasListaArboles().at(-1)?.filtros).not.toContainEqual(
      expect.objectContaining({ columna: 'group_id' }),
    );
  });

  test('"Con foto" excluye las fotos locales sin sincronizar', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.selectOptions(screen.getByLabelText('Foto'), 'con');
    await screen.findByRole('cell', { name: 'A-001' });

    // Mismo criterio que el ✓ de la columna: no basta con que no sea nulo.
    const filtros = consultasListaArboles().at(-1)?.filtros;
    expect(filtros).toContainEqual({
      metodo: 'not',
      columna: 'foto_url',
      operador: 'is',
      valor: null,
    });
    expect(filtros).toContainEqual({
      metodo: 'not',
      columna: 'foto_url',
      operador: 'like',
      valor: 'file://%',
    });
    expect(filtros).toContainEqual({
      metodo: 'not',
      columna: 'foto_url',
      operador: 'like',
      valor: 'content://%',
    });
  });

  test('"Sin foto" incluye las nulas y las locales, en un solo OR', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.selectOptions(screen.getByLabelText('Foto'), 'sin');
    await screen.findByRole('cell', { name: 'A-001' });

    expect(consultasListaArboles().at(-1)?.filtros).toContainEqual({
      metodo: 'or',
      columna: '',
      valor: 'foto_url.is.null,foto_url.like."file://%",foto_url.like."content://%"',
    });
  });

  test('la paginación pide el rango siguiente y muestra el estado', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    // El total y la página viven solo en el pie de la card: la toolbar ya no
    // repite el recuento.
    expect(screen.getByText(/Mostrando 1–50 de 120/)).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.queryByText(/página 1 de 3/)).not.toBeInTheDocument();
    expect(consultasListaArboles().at(-1)?.rango).toEqual({ desde: 0, hasta: 49 });

    await usuario.click(screen.getByRole('button', { name: 'Página siguiente' }));

    expect(await screen.findByText(/Mostrando 51–100 de 120/)).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(consultasListaArboles().at(-1)?.rango).toEqual({ desde: 50, hasta: 99 });
  });

  /** El detalle vive en un <aside> al costado de la tabla (el sidebar del shell
   *  también es un aside: hay que nombrarlo). */
  const PANEL_A001 = { name: 'Detalle del árbol A-001' };

  test('al hacer click en una fila se abre el detalle al costado, con especie y coordenadas', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.click(filaDe('A-001'));

    const panel = await screen.findByRole('complementary', PANEL_A001);
    expect(within(panel).getByText('QB · Quebracho')).toBeInTheDocument();
    expect(within(panel).getByText(/-27\.12346, -55\.65432/)).toBeInTheDocument();
    expect(within(panel).getByText(/±5m/)).toBeInTheDocument();
    // El mapa real está mockeado; basta su placeholder.
    expect(within(panel).getByText('Mapa del árbol')).toBeInTheDocument();
    // La tabla sigue visible al lado: el detalle no la tapa.
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  test('con el panel abierto la tabla suelta las columnas que el panel repite', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    const encabezados = () =>
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((celda) => celda.textContent);
    expect(encabezados()).toEqual(expect.arrayContaining(['GPS', 'Registrado', 'Técnico']));

    await usuario.click(filaDe('A-001'));
    await screen.findByRole('complementary', PANEL_A001);
    expect(encabezados()).not.toEqual(expect.arrayContaining(['GPS']));
    expect(encabezados()).not.toEqual(expect.arrayContaining(['Registrado']));
    expect(encabezados()).not.toEqual(expect.arrayContaining(['Técnico']));

    await usuario.click(screen.getByRole('button', { name: 'Cerrar Detalle del árbol A-001' }));
    await waitFor(() => expect(encabezados()).toEqual(expect.arrayContaining(['GPS'])));
  });

  test('el detalle se cierra con la tecla ESC', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.click(filaDe('A-001'));
    await screen.findByRole('complementary', PANEL_A001);

    await usuario.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('complementary', PANEL_A001)).not.toBeInTheDocument(),
    );
  });

  test('clickear otra fila cambia el panel en vez de cerrarlo', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.click(filaDe('A-001'));
    await screen.findByRole('complementary', PANEL_A001);

    await usuario.click(filaDe('A-002'));
    expect(
      await screen.findByRole('complementary', { name: 'Detalle del árbol A-002' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('complementary', PANEL_A001)).not.toBeInTheDocument();
  });
});
