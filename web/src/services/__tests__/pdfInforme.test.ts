import { QueryClient } from '@tanstack/react-query';
import { opcionesCon, SIN_OPCIONES } from '../../lib/opcionesInforme';
import * as motor from '../../pdf/informe/motorInforme';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { obtenerFuenteDashboard, type FuenteDashboard } from '../../queries/dashboardQueries';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { leerNombreOrganizacion } from '../../queries/fichasQueries';
import { listarPuntosGps } from '../../queries/mapaQueries';
import { especieEnLugar, plantacion } from '../../test/fabricas';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { descargarBlob } from '../descargas';
import { descargarInformePdf, nombreArchivoInforme } from '../pdfInforme';

vi.mock('../../queries/dashboardQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../queries/dashboardQueries')>()),
  obtenerFuenteDashboard: vi.fn(),
}));
vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));
vi.mock('../../queries/fichasQueries', () => ({ leerNombreOrganizacion: vi.fn() }));
vi.mock('../../queries/mapaQueries', () => ({ listarPuntosGps: vi.fn() }));
vi.mock('../descargas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../descargas')>()),
  descargarBlob: vi.fn(),
}));
vi.mock('../../pdf/informe/motorInforme', () => ({
  emisionDePlantacion: vi.fn(),
  renderizarInforme: vi.fn(),
}));

const PLANTACION = plantacion({
  lugar: 'San Sebastián',
  periodo: '2025-2026',
  codigo: 'SS26',
  estado: 'activa',
  objetivoArboles: 8000,
});
const BLOB = new Blob(['%PDF']);
const EMISION = {
  encabezado: { logo: '/logo.png', titulo: 'San Sebastián · 2025-2026', detalle: 'SS26' },
  emitido: '12/10/2026',
};

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
const CON_MAPA = opcionesCon(['mapa']);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obtenerFuenteDashboard).mockResolvedValue(FUENTE);
  vi.mocked(leerNombreOrganizacion).mockResolvedValue('Bayka');
  vi.mocked(listarPuntosGps).mockResolvedValue([]);
  vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([especieEnLugar('LAP', 2)]);
  vi.mocked(motor.emisionDePlantacion).mockReturnValue(EMISION);
  vi.mocked(motor.renderizarInforme).mockResolvedValue(BLOB);
});

test('nombre del archivo', () => {
  expect(nombreArchivoInforme('San Sebastián', '2025-2026')).toBe(
    'informe-san-sebastian-2025-2026.pdf',
  );
});

test('cubre la plantación entera, con la etiqueta del estado, y se descarga', async () => {
  await descargarInformePdf(PLANTACION, new QueryClient(), CON_MAPA);

  const pedido = vi.mocked(motor.renderizarInforme).mock.calls[0][0];
  expect(pedido.dashboard.totalArboles).toBe(5);
  expect(pedido.dashboard.porParcela.map((parcela) => parcela.cantidad)).toEqual([3, 2]);
  expect(pedido.opciones).toBe(CON_MAPA);
  expect(pedido.plantacion).toMatchObject({ lugar: 'San Sebastián', estado: 'Activa' });
  expect(pedido.objetivo).toBe(8000);
  expect(pedido.organizacion).toBe('Bayka');
  expect(motor.emisionDePlantacion).toHaveBeenCalledWith(PLANTACION, 'Bayka');
  expect(pedido).toMatchObject(EMISION);
  expect(descargarBlob).toHaveBeenCalledWith(BLOB, 'informe-san-sebastian-2025-2026.pdf');
});

test('pinta cada especie con el color de su lugar en la plantación (#845)', async () => {
  await descargarInformePdf(PLANTACION, new QueryClient(), CON_MAPA);
  expect(listarEspeciesDePlantacion).toHaveBeenCalledWith(PLANTACION.id);
  expect(vi.mocked(motor.renderizarInforme).mock.calls[0][0].colorDe('LAP')).toBe('#3b7db5');
});

test('sin especies legibles, el informe sale igual con los colores por hash', async () => {
  vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('rls'));
  await descargarInformePdf(PLANTACION, new QueryClient(), CON_MAPA);
  const { colorDe } = vi.mocked(motor.renderizarInforme).mock.calls[0][0];
  expect(colorDe('LAP')).toBe(colorEspeciePorCodigo('LAP'));
  expect(descargarBlob).toHaveBeenCalled();
});

test('reutiliza las lecturas vigentes que el dashboard dejó en caché', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(CLAVE_QUERY.dashboard(PLANTACION.id), FUENTE);
  queryClient.setQueryData(CLAVE_QUERY.mapa(PLANTACION.id), []);
  await descargarInformePdf(PLANTACION, queryClient, CON_MAPA);
  expect(obtenerFuenteDashboard).not.toHaveBeenCalled();
  expect(listarPuntosGps).not.toHaveBeenCalled();
});

test('sin organización ni puntos legibles, el informe sale igual', async () => {
  vi.mocked(leerNombreOrganizacion).mockRejectedValue(new Error('rls'));
  vi.mocked(listarPuntosGps).mockRejectedValue(new Error('red'));
  await descargarInformePdf(PLANTACION, new QueryClient(), CON_MAPA);
  const pedido = vi.mocked(motor.renderizarInforme).mock.calls[0][0];
  expect(pedido.organizacion).toBeNull();
  expect(motor.emisionDePlantacion).toHaveBeenCalledWith(PLANTACION, null);
  expect(pedido.puntos).toBeNull();
  expect(descargarBlob).toHaveBeenCalled();
});

test('sin el mapa elegido no lee los puntos GPS', async () => {
  await descargarInformePdf(PLANTACION, new QueryClient(), SIN_OPCIONES);
  expect(listarPuntosGps).not.toHaveBeenCalled();
  const pedido = vi.mocked(motor.renderizarInforme).mock.calls[0][0];
  expect(pedido.puntos).toBeNull();
  expect(pedido.opciones).toBe(SIN_OPCIONES);
  expect(descargarBlob).toHaveBeenCalled();
});

test('si el dashboard no se puede leer, falla sin descargar nada', async () => {
  vi.mocked(obtenerFuenteDashboard).mockRejectedValue(new Error('red'));
  await expect(descargarInformePdf(PLANTACION, new QueryClient(), CON_MAPA)).rejects.toThrow('red');
  expect(descargarBlob).not.toHaveBeenCalled();
});
