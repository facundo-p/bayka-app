import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { configurarPlantacionesMock } from '../../test/plantacionesMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import { listarPlantaciones, obtenerTemporadaActivaId } from '../plantationQueries';

vi.mock('../../lib/supabase', async () => {
  const { supabaseMock } = await import('../../test/supabaseMock');
  return { supabase: supabaseMock };
});

beforeEach(resetEstadoMock);

const FILA_MENDOZA = {
  id: 'plant-1',
  lugar: 'Mendoza',
  periodo: '2025-2026',
  estado: 'activa',
  created_at: '2026-06-12T12:00:00Z',
  visible_in_app: false,
};

test('mapea la fila a camelCase y agrega los counts', async () => {
  configurarPlantacionesMock([FILA_MENDOZA], {
    'plant-1': { arboles: 120, parcelas: 3, usuarios: 2 },
  });
  const resultado = await listarPlantaciones();
  expect(resultado).toEqual([
    {
      id: 'plant-1',
      lugar: 'Mendoza',
      periodo: '2025-2026',
      estado: 'activa',
      visibleInApp: false,
      gpsCaptureFrequency: 10,
      gpsCaptureRequired: true,
      createdAt: '2026-06-12T12:00:00Z',
      arboles: 120,
      parcelas: 3,
      usuarios: 2,
      descripcion: null,
      fechaInicio: null,
      objetivoArboles: null,
    },
  ]);
});

test('mapea los campos del formulario cuando la 024 está aplicada', async () => {
  configurarPlantacionesMock([
    { ...FILA_MENDOZA, descripcion: 'Finca norte', fecha_inicio: '2026-07-01', objetivo_arboles: 500 },
  ]);
  const [plantacion] = await listarPlantaciones();
  expect(plantacion.descripcion).toBe('Finca norte');
  expect(plantacion.fechaInicio).toBe('2026-07-01');
  expect(plantacion.objetivoArboles).toBe(500);
});

test('mapea la config GPS cuando la 023 está aplicada (sin columnas usa defaults)', async () => {
  configurarPlantacionesMock([
    { ...FILA_MENDOZA, gps_capture_frequency: 5, gps_capture_required: false },
  ]);
  const [plantacion] = await listarPlantaciones();
  expect(plantacion.gpsCaptureFrequency).toBe(5);
  expect(plantacion.gpsCaptureRequired).toBe(false);
});

test('sin visible_in_app (migración 024 no aplicada) asume visible', async () => {
  const filaSinColumna: Record<string, unknown> = { ...FILA_MENDOZA };
  delete filaSinColumna.visible_in_app;
  configurarPlantacionesMock([filaSinColumna]);
  const [plantacion] = await listarPlantaciones();
  expect(plantacion.visibleInApp).toBe(true);
  expect(plantacion.arboles).toBe(0);
});

test('los contadores salen del RPC agregado, en una sola llamada', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return consulta.tabla === 'plantations'
      ? { data: [FILA_MENDOZA], error: null }
      : { data: [{ plantation_id: 'plant-1', arboles: 7, parcelas: 2, usuarios: 1 }], error: null };
  };
  const [plantacion] = await listarPlantaciones();

  expect(plantacion).toMatchObject({ arboles: 7, parcelas: 2, usuarios: 1 });
  const rpcs = consultas.filter((consulta) => consulta.operacion === 'rpc');
  expect(rpcs.map((consulta) => consulta.tabla)).toEqual(['stats_plantaciones']);
});

test('plantación sin fila en el RPC (recién creada) muestra contadores en cero', async () => {
  configurarPlantacionesMock([FILA_MENDOZA], {});
  const [plantacion] = await listarPlantaciones();
  expect(plantacion).toMatchObject({ arboles: 0, parcelas: 0, usuarios: 0 });
});

test('propaga el error de Supabase', async () => {
  estadoMock.resolverConsulta = () => ({ data: null, error: { message: 'sin permisos' } });
  await expect(listarPlantaciones()).rejects.toThrow('sin permisos');
});

test('temporada activa: id de la plantación activa con el árbol más reciente', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return { data: [{ created_at: '2026-06-20T10:00:00Z', groups: { plantation_id: 'plant-9' } }], error: null };
  };
  await expect(obtenerTemporadaActivaId()).resolves.toBe('plant-9');
  const trees = consultas.find((consulta) => consulta.tabla === 'trees');
  expect(trees?.filtros).toContainEqual({ metodo: 'eq', columna: 'groups.plantations.estado', valor: 'activa' });
});

test('temporada activa: null si ninguna activa tiene árboles', async () => {
  estadoMock.resolverConsulta = () => ({ data: [], error: null });
  await expect(obtenerTemporadaActivaId()).resolves.toBeNull();
});
