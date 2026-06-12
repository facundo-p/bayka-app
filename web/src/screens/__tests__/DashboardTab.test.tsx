import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PERFIL_ADMIN, estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import type { ConsultaCapturada, RespuestaMock } from '../../test/queryBuilderMock';
import { capturarConsultas } from '../../test/capturarConsultas';
import { renderRutasEn } from '../../test/renderConRutas';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

// Recharts mide el contenedor con APIs de layout que jsdom no implementa:
// se reemplazan los gráficos por contenedores tontos. Los datos de los
// gráficos ya están cubiertos por los tests de las funciones puras.
vi.mock('recharts', () => {
  const Contenedor = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Nada = () => null;
  return {
    ResponsiveContainer: Contenedor,
    PieChart: Contenedor,
    BarChart: Contenedor,
    LineChart: Contenedor,
    Pie: Nada,
    Bar: Nada,
    Line: Nada,
    Cell: Nada,
    Legend: Nada,
    Tooltip: Nada,
    XAxis: Nada,
    YAxis: Nada,
    CartesianGrid: Nada,
  };
});

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
  group_id: 'gr-1',
  groups: { plantation_id: 'plant-1', parcela_id: 'parc-1' },
};

/** 5 árboles: 3 con GPS (60%), 2 con foto subida (40%), 1 N/N, 2 especies. */
const FILAS_ARBOLES = [
  ARBOL_BASE,
  ARBOL_BASE,
  { ...ARBOL_BASE, species_id: 'sp-2', foto_url: 'file:///data/foto.jpg' },
  { ...ARBOL_BASE, latitude: null, foto_url: null },
  { ...ARBOL_BASE, species_id: null, latitude: null, foto_url: null },
];

const CATALOGO = [
  { id: 'sp-1', codigo: 'QB', nombre: 'Quebracho', nombre_cientifico: null },
  { id: 'sp-2', codigo: 'AL', nombre: 'Algarrobo', nombre_cientifico: null },
];

const FILAS_PARCELAS = [
  { id: 'parc-1', nombre: 'Norte', codigo: 'P1' },
  { id: 'parc-2', nombre: 'Sur', codigo: 'P2' },
];

function crearResolver(arboles: RespuestaMock['data']) {
  return (consulta: ConsultaCapturada): RespuestaMock => {
    if (consulta.tabla === 'plantations') return { data: FILA_PLANTACION };
    if (consulta.tabla === 'trees') return { data: arboles };
    if (consulta.tabla === 'species') return { data: CATALOGO };
    if (consulta.tabla === 'parcelas') return { data: FILAS_PARCELAS };
    if (consulta.tabla === 'groups') return { count: 3 };
    return { data: [], count: 0 };
  };
}

beforeEach(() => {
  resetEstadoMock();
  estadoMock.sesion = { user: { id: 'user-1' } };
  estadoMock.perfilFila = PERFIL_ADMIN;
});

describe('DashboardTab', () => {
  test('muestra los KPIs calculados a partir de los árboles', async () => {
    capturarConsultas(crearResolver(FILAS_ARBOLES));
    renderRutasEn('/plantaciones/plant-1');

    expect(await screen.findByText('Árboles totales')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // grupos
    expect(screen.getAllByText('2')).toHaveLength(2); // parcelas y especies
    expect(screen.getByText('60%')).toBeInTheDocument(); // con GPS
    expect(screen.getByText('40%')).toBeInTheDocument(); // con foto
    expect(screen.getByText('1')).toBeInTheDocument(); // N/N pendientes
    // Progreso hacia el objetivo de la migración 024.
    expect(screen.getByText('5 de 10 (50%)')).toBeInTheDocument();
    // Los tres gráficos presentes, cada uno en su card con título.
    expect(screen.getByText('Árboles por especie')).toBeInTheDocument();
    expect(screen.getByText('Árboles por parcela')).toBeInTheDocument();
    expect(screen.getByText('Registros por mes')).toBeInTheDocument();
  });

  test('sin árboles muestra el estado vacío y ningún gráfico', async () => {
    capturarConsultas(crearResolver([]));
    renderRutasEn('/plantaciones/plant-1');

    expect(await screen.findByText('Todavía no hay árboles registrados')).toBeInTheDocument();
    expect(screen.queryByText('Árboles por especie')).not.toBeInTheDocument();
    expect(screen.queryByText('Árboles totales')).not.toBeInTheDocument();
  });
});
