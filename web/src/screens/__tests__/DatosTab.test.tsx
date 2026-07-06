import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

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
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
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
  test('la tab Datos redirige a parcelas y lista con counts', async () => {
    renderRutasEn('/plantaciones/plant-1/datos');

    expect(await screen.findByRole('cell', { name: 'Norte' })).toBeInTheDocument();
    const fila = filaDe('Norte');
    expect(within(fila).getByRole('cell', { name: 'P1' })).toBeInTheDocument();
    expect(within(fila).getByRole('cell', { name: '4' })).toBeInTheDocument();
    expect(within(fila).getByRole('cell', { name: '10' })).toBeInTheDocument();
    // Sub-tabs de la tab Datos presentes.
    expect(screen.getByRole('link', { name: 'Grupos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Árboles' })).toBeInTheDocument();
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
  test('muestra badge N/N sin especie y deja el GPS vacío sin coordenadas', async () => {
    renderRutasEn('/plantaciones/plant-1/datos/arboles');

    expect(await screen.findByRole('cell', { name: 'A-001' })).toBeInTheDocument();
    const filaCompleta = filaDe('A-001');
    expect(within(filaCompleta).getByText('QB — Quebracho')).toBeInTheDocument();
    expect(within(filaCompleta).getByText(/-27\.12346, -55\.65432/)).toBeInTheDocument();
    expect(within(filaCompleta).getByText(/±5m/)).toBeInTheDocument();
    expect(within(filaCompleta).getByText('Teo Técnico')).toBeInTheDocument();
    expect(within(filaCompleta).getByRole('button', { name: 'Ver' })).toBeInTheDocument();

    const filaVacia = filaDe('A-002');
    expect(within(filaVacia).getByText('N/N')).toBeInTheDocument();
    // Sin coordenadas la celda GPS queda vacía (nunca "0,0").
    expect(within(filaVacia).queryByText(/-?\d+\.\d{5}/)).not.toBeInTheDocument();
    // La foto local de mobile no cuenta como subida: sin botón Ver.
    expect(within(filaVacia).queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument();
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

  test('la paginación pide el rango siguiente y muestra el estado', async () => {
    const usuario = userEvent.setup();
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    expect(screen.getByText('Página 1 de 3 · total 120 árboles')).toBeInTheDocument();
    expect(consultasListaArboles().at(-1)?.rango).toEqual({ desde: 0, hasta: 49 });

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 3 · total 120 árboles')).toBeInTheDocument();
    expect(consultasListaArboles().at(-1)?.rango).toEqual({ desde: 50, hasta: 99 });
  });

  test('el botón Ver abre la foto firmada en una pestaña nueva', async () => {
    const usuario = userEvent.setup();
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderRutasEn('/plantaciones/plant-1/datos/arboles');
    await screen.findByRole('cell', { name: 'A-001' });

    await usuario.click(screen.getByRole('button', { name: 'Ver' }));

    expect(estadoMock.firmas).toEqual([
      { bucket: 'tree-photos', path: 'plantations/p1/trees/tree-1.jpg', segundos: 3600 },
    ]);
    expect(abrir).toHaveBeenCalledWith(
      'https://firmada.test/plantations/p1/trees/tree-1.jpg',
      '_blank',
      'noopener',
    );
    abrir.mockRestore();
  });
});
