import { estadoMock, resetEstadoMock } from '../../test/supabaseMock';
import { configurarPlantacionesMock } from '../../test/plantacionesMock';
import type { ConsultaCapturada } from '../../test/queryBuilderMock';
import { listarPlantaciones } from '../plantationQueries';

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
      superficieHa: null,
      ubicacionLat: null,
      ubicacionLng: null,
      objetivoArboles: null,
    },
  ]);
});

test('mapea los campos del formulario cuando la 024 está aplicada', async () => {
  configurarPlantacionesMock([
    { ...FILA_MENDOZA, descripcion: 'Finca norte', superficie_ha: 12.5, objetivo_arboles: 500 },
  ]);
  const [plantacion] = await listarPlantaciones();
  expect(plantacion.descripcion).toBe('Finca norte');
  expect(plantacion.superficieHa).toBe(12.5);
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

test('los counts filtran por plantación y excluyen parcelas borradas', async () => {
  const consultas: ConsultaCapturada[] = [];
  estadoMock.resolverConsulta = (consulta) => {
    consultas.push(consulta);
    return consulta.tabla === 'plantations'
      ? { data: [FILA_MENDOZA], error: null }
      : { count: 0, error: null };
  };
  await listarPlantaciones();

  const arboles = consultas.find((consulta) => consulta.tabla === 'trees');
  expect(arboles?.opciones).toEqual({ count: 'exact', head: true });
  expect(arboles?.filtros).toEqual([
    { metodo: 'eq', columna: 'groups.plantation_id', valor: 'plant-1' },
  ]);

  const parcelas = consultas.find((consulta) => consulta.tabla === 'parcelas');
  expect(parcelas?.filtros).toEqual([
    { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
    { metodo: 'is', columna: 'deleted_at', valor: null },
  ]);

  const usuarios = consultas.find((consulta) => consulta.tabla === 'plantation_users');
  expect(usuarios?.filtros).toEqual([
    { metodo: 'eq', columna: 'plantation_id', valor: 'plant-1' },
  ]);
});

test('propaga el error de Supabase', async () => {
  estadoMock.resolverConsulta = () => ({ data: null, error: { message: 'sin permisos' } });
  await expect(listarPlantaciones()).rejects.toThrow('sin permisos');
});
