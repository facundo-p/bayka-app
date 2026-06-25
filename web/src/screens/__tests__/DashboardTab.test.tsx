import { screen } from '@testing-library/react';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

// Leaflet usa APIs de layout que jsdom no implementa: se reemplaza el mapa por
// un contenedor tonto. El mapa real se valida en el navegador, no en jsdom.
vi.mock('../../components/PlantationMap', () => ({
  PlantationMap: () => <div>Mapa de la plantación</div>,
}));

const FILA_PLANTACION = {
  id: 'plant-1',
  lugar: 'Mendoza',
  periodo: '2025-2026',
  estado: 'activa',
  created_at: '2026-06-12T12:00:00Z',
  visible_in_app: true,
  objetivo_arboles: 10,
};

const ARBOL_BASE = {
  species_id: 'sp-1',
  foto_url: 'plantations/p1/trees/t1.jpg',
  created_at: '2026-06-03T12:00:00Z',
  latitude: -27.1,
  longitude: -55.2,
  group_id: 'gr-1',
  groups: { plantation_id: 'plant-1', parcela_id: 'parc-1' },
};

/** 5 árboles: 3 con GPS (60%), 2 con foto subida (40%), 1 N/N, 2 especies. */
const FILAS_ARBOLES = [
  ARBOL_BASE,
  ARBOL_BASE,
  { ...ARBOL_BASE, species_id: 'sp-2', foto_url: 'file:///data/foto.jpg' },
  { ...ARBOL_BASE, latitude: null, longitude: null, foto_url: null },
  { ...ARBOL_BASE, species_id: null, latitude: null, longitude: null, foto_url: null },
];

const CATALOGO = [
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombre_cientifico: null },
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombre_cientifico: null },
];

const FILAS_PARCELAS = [
  { id: 'parc-1', nombre: 'Norte', codigo: 'P1', descripcion: null, created_at: '2026-06-01T00:00:00Z' },
  { id: 'parc-2', nombre: 'Sur', codigo: 'P2', descripcion: null, created_at: '2026-06-01T00:00:00Z' },
];

/** Puntos GPS del mapa: árboles con lat/lng no nulos + su especie embebida. */
const FILAS_PUNTOS = [
  { latitude: -27.1, longitude: -55.2, species_id: 'sp-1', species: { codigo: 'QB', nombre: 'Quebracho' } },
];

function esConteo(consulta: ConsultaCapturada): boolean {
  return consulta.opciones?.head === true;
}

/** Distingue la lectura de puntos del mapa (trae longitude) de la del dashboard. */
function esLecturaPuntos(consulta: ConsultaCapturada): boolean {
  return (consulta.columnas ?? '').includes('longitude');
}

function crearResolver(arboles: RespuestaMock['data']) {
  return (consulta: ConsultaCapturada): RespuestaMock => {
    if (consulta.tabla === 'plantations') return { data: FILA_PLANTACION };
    if (consulta.tabla === 'species') return { data: CATALOGO };
    if (consulta.tabla === 'parcelas') return { data: FILAS_PARCELAS };
    if (consulta.tabla === 'groups') return esConteo(consulta) ? { count: 2 } : { count: 3 };
    if (consulta.tabla === 'trees') {
      if (esConteo(consulta)) return { count: 4 };
      if (esLecturaPuntos(consulta)) return { data: FILAS_PUNTOS };
      return { data: arboles };
    }
    return { data: [], count: 0 };
  };
}

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
});

describe('DashboardTab', () => {
  test('muestra el hero, los KPIs y los paneles de especies y parcelas', async () => {
    capturarConsultas(crearResolver(FILAS_ARBOLES));
    renderRutasEn('/plantaciones/plant-1');

    // Número hero (total de árboles) y overline.
    expect(await screen.findByText('5')).toBeInTheDocument();
    expect(screen.getByText('Árboles registrados')).toBeInTheDocument();
    // StatCards de tasas y alerta N/N.
    expect(screen.getByText('Con GPS')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Con foto')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('N/N sin resolver')).toBeInTheDocument();
    expect(screen.getByText('requieren atención')).toBeInTheDocument();
    // Paneles nuevos.
    expect(screen.getByText('Por especie')).toBeInTheDocument();
    expect(screen.getByText('Parcelas')).toBeInTheDocument();
  });

  test('sin árboles muestra el estado vacío y ningún panel', async () => {
    capturarConsultas(crearResolver([]));
    renderRutasEn('/plantaciones/plant-1');

    expect(await screen.findByText('Todavía no hay árboles registrados')).toBeInTheDocument();
    expect(screen.queryByText('Por especie')).not.toBeInTheDocument();
    expect(screen.queryByText('Con GPS')).not.toBeInTheDocument();
  });
});
