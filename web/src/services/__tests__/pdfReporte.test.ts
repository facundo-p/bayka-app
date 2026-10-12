import { QueryClient } from '@tanstack/react-query';
import type { ModeloArbolReporte, ModeloTarjeta } from '../../pdf/reporte/datosReporte';
import * as motor from '../../pdf/reporte/motorReporte';
import { MODO_REPORTE } from '../../pdf/reporte/planReporte';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { leerNombreOrganizacion, type ArbolParaFicha } from '../../queries/fichasQueries';
import { arbolParaFicha, especieDePlantacion, plantacion } from '../../test/fabricas';
import { ERROR_REPORTE_SIN_ARBOLES, generarPdfReporte, type ProgresoReporte } from '../pdfReporte';

vi.mock('../../queries/fichasQueries', () => ({ leerNombreOrganizacion: vi.fn() }));
vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));
vi.mock('../../pdf/reporte/motorReporte', () => ({
  cargarFotos: vi.fn(),
  datosTarjeta: vi.fn(),
  datosArbolReporte: vi.fn(),
  encabezadoDePlantacion: vi.fn(),
  logoNavegador: vi.fn(),
  renderizarReporte: vi.fn(),
}));

const PLANTACION = plantacion({ lugar: 'San Sebastián', periodo: '2025-2026' });
const BLOB = new Blob(['%PDF']);
const ENCABEZADO = { logo: '/logo.png', titulo: 'San Sebastián · 2025-2026', detalle: 'SS26' };
const FOTO_LISTA = { estado: 'lista', src: 'data:image/jpeg;base64,F' } as const;
const ANC = especieDePlantacion({ id: 's1', codigo: 'ANC', nombre: 'Anchico', lugarColor: 1 });

const conFoto = (n: number) => arbolParaFicha({ id: `f${n}`, fotoUrl: `p/${n}.jpg` });
const sinFoto = (n: number) => arbolParaFicha({ id: `s${n}`, fotoUrl: null });
const muchos = (cantidad: number, fabrica: (n: number) => ArbolParaFicha) =>
  Array.from({ length: cantidad }, (_, n) => fabrica(n));

const contexto = () => ({ plantacion: PLANTACION, queryClient: new QueryClient() });

/** Cuántas tarjetas y filas recibió el documento. */
function repartoRenderizado() {
  const { reparto } = vi.mocked(motor.renderizarReporte).mock.lastCall![0];
  return { tarjetas: reparto.tarjetas.length, listado: reparto.listado.length };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(leerNombreOrganizacion).mockResolvedValue('Bayka');
  vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([ANC]);
  vi.mocked(motor.cargarFotos).mockImplementation(async (urls) => urls.map(() => FOTO_LISTA));
  vi.mocked(motor.datosTarjeta).mockImplementation(
    (arbol, foto) => ({ idArbol: arbol.id, foto }) as unknown as ModeloTarjeta,
  );
  vi.mocked(motor.datosArbolReporte).mockImplementation(
    (arbol) => ({ idArbol: arbol.id }) as unknown as ModeloArbolReporte,
  );
  vi.mocked(motor.encabezadoDePlantacion).mockReturnValue(ENCABEZADO);
  vi.mocked(motor.logoNavegador).mockReturnValue('/logo.png');
  vi.mocked(motor.renderizarReporte).mockResolvedValue(BLOB);
});

test('con 450 árboles con foto baja solo las 400 de las tarjetas; los 50 restantes van al listado', async () => {
  const arboles = muchos(450, conFoto);
  const blob = await generarPdfReporte({ arboles, modo: MODO_REPORTE.conFotos }, contexto());
  expect(blob).toBe(BLOB);
  const [urls] = vi.mocked(motor.cargarFotos).mock.lastCall!;
  expect(urls).toEqual(arboles.slice(0, 400).map((arbol) => arbol.fotoUrl));
  expect(repartoRenderizado()).toEqual({ tarjetas: 400, listado: 50 });
});

test('cada tarjeta lleva la foto de su árbol', async () => {
  vi.mocked(motor.cargarFotos).mockResolvedValue([{ estado: 'no-disponible' }, FOTO_LISTA]);
  await generarPdfReporte(
    { arboles: [conFoto(1), sinFoto(2), conFoto(3)], modo: MODO_REPORTE.conFotos },
    contexto(),
  );
  const { reparto } = vi.mocked(motor.renderizarReporte).mock.lastCall![0];
  expect(reparto.tarjetas).toEqual([
    { idArbol: 'f1', foto: { estado: 'no-disponible' } },
    { idArbol: 'f3', foto: FOTO_LISTA },
  ]);
  expect(reparto.listado).toEqual([{ idArbol: 's2' }]);
});

test('sin fotos, o sin árboles con foto, no baja ninguna', async () => {
  await generarPdfReporte({ arboles: muchos(5, conFoto), modo: MODO_REPORTE.sinFotos }, contexto());
  await generarPdfReporte(
    { arboles: muchos(7000, sinFoto), modo: MODO_REPORTE.conFotos },
    contexto(),
  );
  expect(motor.cargarFotos).not.toHaveBeenCalled();
  expect(repartoRenderizado()).toEqual({ tarjetas: 0, listado: 7000 });
});

test('avisa el progreso de la bajada de fotos y después el armado del PDF', async () => {
  vi.mocked(motor.cargarFotos).mockImplementation(async (urls, opciones) => {
    opciones?.alProgresar?.(0, urls.length);
    opciones?.alProgresar?.(urls.length, urls.length);
    return urls.map(() => FOTO_LISTA);
  });
  const etapas: ProgresoReporte[] = [];
  await generarPdfReporte(
    {
      arboles: muchos(2, conFoto),
      modo: MODO_REPORTE.conFotos,
      alProgresar: (progreso) => etapas.push(progreso),
    },
    contexto(),
  );
  expect(etapas).toEqual([
    { etapa: 'bajando-fotos', listas: 0, total: 2 },
    { etapa: 'bajando-fotos', listas: 2, total: 2 },
    { etapa: 'armando-pdf' },
  ]);
});

test('el encabezado lleva la plantación y su organización; sin organización legible sale igual', async () => {
  await generarPdfReporte({ arboles: [sinFoto(1)], modo: MODO_REPORTE.conFotos }, contexto());
  expect(motor.encabezadoDePlantacion).toHaveBeenCalledWith(PLANTACION, 'Bayka', '/logo.png');
  vi.mocked(leerNombreOrganizacion).mockRejectedValue(new Error('rls'));
  await generarPdfReporte({ arboles: [sinFoto(1)], modo: MODO_REPORTE.conFotos }, contexto());
  expect(motor.encabezadoDePlantacion).toHaveBeenLastCalledWith(PLANTACION, null, '/logo.png');
});

test('los colores de especie son los de la plantación', async () => {
  await generarPdfReporte({ arboles: [sinFoto(1)], modo: MODO_REPORTE.conFotos }, contexto());
  const colorDe = vi.mocked(motor.datosArbolReporte).mock.lastCall![1];
  expect(listarEspeciesDePlantacion).toHaveBeenCalledWith(PLANTACION.id);
  expect(colorDe('ANC')).toBe('#99b95b');
});

test('sin árboles falla sin cargar el motor', async () => {
  await expect(
    generarPdfReporte({ arboles: [], modo: MODO_REPORTE.conFotos }, contexto()),
  ).rejects.toThrow(ERROR_REPORTE_SIN_ARBOLES);
  expect(motor.renderizarReporte).not.toHaveBeenCalled();
});
