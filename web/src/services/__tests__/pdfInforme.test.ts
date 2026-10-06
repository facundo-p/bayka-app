import { QueryClient } from '@tanstack/react-query';
import * as motor from '../../pdf/informe/motorInforme';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { obtenerFuenteDashboard, type FuenteDashboard } from '../../queries/dashboardQueries';
import { listarParcelasConStats, type ParcelaConStats } from '../../queries/dataExplorerQueries';
import { leerNombreOrganizacion } from '../../queries/fichasQueries';
import { listarPuntosGps } from '../../queries/mapaQueries';
import { plantacion } from '../../test/fabricas';
import { descargarBlob } from '../descargas';
import { descargarInformePdf, nombreArchivoInforme } from '../pdfInforme';

vi.mock('../../queries/dashboardQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../queries/dashboardQueries')>()),
  obtenerFuenteDashboard: vi.fn(),
}));
vi.mock('../../queries/dataExplorerQueries', () => ({ listarParcelasConStats: vi.fn() }));
vi.mock('../../queries/fichasQueries', () => ({ leerNombreOrganizacion: vi.fn() }));
vi.mock('../../queries/mapaQueries', () => ({ listarPuntosGps: vi.fn() }));
vi.mock('../descargas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../descargas')>()),
  descargarBlob: vi.fn(),
}));
vi.mock('../../pdf/informe/motorInforme', () => ({ renderizarInforme: vi.fn() }));

const PLANTACION = plantacion({
  lugar: 'San Sebastián',
  periodo: '2025-2026',
  codigo: 'SS26',
  estado: 'activa',
  objetivoArboles: 8000,
});
const BLOB = new Blob(['%PDF']);

const conteo = (parcelaId: string, cantidad: number) => ({
  parcelaId,
  speciesId: 'e1',
  mes: '2026-06',
  conGps: true,
  conFoto: false,
  cantidad,
});

const FUENTE: FuenteDashboard = {
  arboles: [conteo('pa', 3), conteo('pb', 2)],
  especies: [{ id: 'e1', codigo: 'LAP', nombre: 'Lapacho' } as FuenteDashboard['especies'][0]],
  parcelas: [
    { id: 'pa', codigo: 'A', nombre: 'Norte' },
    { id: 'pb', codigo: 'B', nombre: 'Sur' },
  ],
  totalGrupos: 3,
};
const PARCELAS = [{ id: 'pa', codigo: 'A', grupos: 2 }] as ParcelaConStats[];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obtenerFuenteDashboard).mockResolvedValue(FUENTE);
  vi.mocked(listarParcelasConStats).mockResolvedValue(PARCELAS);
  vi.mocked(leerNombreOrganizacion).mockResolvedValue('Bayka');
  vi.mocked(listarPuntosGps).mockResolvedValue([]);
  vi.mocked(motor.renderizarInforme).mockResolvedValue(BLOB);
});

test('nombre del archivo', () => {
  expect(nombreArchivoInforme('San Sebastián', '2025-2026')).toBe(
    'informe-san-sebastian-2025-2026.pdf',
  );
});

test('cubre la plantación entera, con la etiqueta del estado, y se descarga', async () => {
  await descargarInformePdf(PLANTACION, new QueryClient());

  const pedido = vi.mocked(motor.renderizarInforme).mock.calls[0][0];
  expect(pedido.dashboard.totalArboles).toBe(5);
  expect(pedido.dashboard.porParcela.map((parcela) => parcela.cantidad)).toEqual([3, 2]);
  expect(pedido.parcelas).toBe(PARCELAS);
  expect(pedido.plantacion).toMatchObject({ lugar: 'San Sebastián', estado: 'Activa' });
  expect(pedido.objetivo).toBe(8000);
  expect(pedido.organizacion).toBe('Bayka');
  expect(descargarBlob).toHaveBeenCalledWith(BLOB, 'informe-san-sebastian-2025-2026.pdf');
});

test('reutiliza las lecturas vigentes que el dashboard dejó en caché', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(CLAVE_QUERY.dashboard(PLANTACION.id), FUENTE);
  queryClient.setQueryData(CLAVE_QUERY.mapa(PLANTACION.id), []);
  queryClient.setQueryData(CLAVE_QUERY.datosParcelas(PLANTACION.id), PARCELAS);
  await descargarInformePdf(PLANTACION, queryClient);
  expect(obtenerFuenteDashboard).not.toHaveBeenCalled();
  expect(listarPuntosGps).not.toHaveBeenCalled();
  expect(listarParcelasConStats).not.toHaveBeenCalled();
});

test('sin organización ni puntos legibles, el informe sale igual', async () => {
  vi.mocked(leerNombreOrganizacion).mockRejectedValue(new Error('rls'));
  vi.mocked(listarPuntosGps).mockRejectedValue(new Error('red'));
  await descargarInformePdf(PLANTACION, new QueryClient());
  const pedido = vi.mocked(motor.renderizarInforme).mock.calls[0][0];
  expect(pedido.organizacion).toBeNull();
  expect(pedido.puntos).toBeNull();
  expect(descargarBlob).toHaveBeenCalled();
});

test('si el dashboard no se puede leer, falla sin descargar nada', async () => {
  vi.mocked(obtenerFuenteDashboard).mockRejectedValue(new Error('red'));
  await expect(descargarInformePdf(PLANTACION, new QueryClient())).rejects.toThrow('red');
  expect(descargarBlob).not.toHaveBeenCalled();
});
