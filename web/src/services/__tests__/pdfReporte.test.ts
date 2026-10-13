import { QueryClient } from '@tanstack/react-query';
import type { ModeloArbolReporte, ModeloTarjeta } from '../../pdf/reporte/datosReporte';
import * as motor from '../../pdf/reporte/motorReporte';
import { MODO_REPORTE } from '../../pdf/reporte/planReporte';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import {
  leerNombreOrganizacion,
  listarArbolesDelFiltro,
  type ArbolParaFicha,
} from '../../queries/fichasQueries';
import { arbolParaFicha, especieDePlantacion, plantacion } from '../../test/fabricas';
import { descargarBlob } from '../descargas';
import {
  ERROR_REPORTE_SIN_ARBOLES,
  descargarReportePdf,
  generarPdfReporte,
  type ProgresoReporte,
} from '../pdfReporte';

vi.mock('../../queries/fichasQueries', () => ({
  leerNombreOrganizacion: vi.fn(),
  listarArbolesDelFiltro: vi.fn(),
}));
vi.mock('../descargas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../descargas')>()),
  descargarBlob: vi.fn(),
}));
vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));
vi.mock('../../pdf/reporte/motorReporte', () => ({
  cargarFotos: vi.fn(),
  datosTarjeta: vi.fn(),
  datosArbolReporte: vi.fn(),
  emisionDePlantacion: vi.fn(),
  renderizarReporte: vi.fn(),
}));

const PLANTACION = plantacion({ lugar: 'San Sebastián', periodo: '2025-2026' });
const BLOB = new Blob(['%PDF']);
const ENCABEZADO = { logo: '/logo.png', titulo: 'San Sebastián · 2025-2026', detalle: 'SS26' };
const EMISION = { encabezado: ENCABEZADO, emitido: '12/10/2026' };
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
  vi.mocked(motor.emisionDePlantacion).mockReturnValue(EMISION);
  vi.mocked(motor.renderizarReporte).mockResolvedValue(BLOB);
});

test('con 450 árboles con foto baja solo las 400 de las tarjetas; los 50 restantes van al listado', async () => {
  const arboles = muchos(450, conFoto);
  const { blob } = await generarPdfReporte({ arboles, modo: MODO_REPORTE.conFotos }, contexto());
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
  expect(motor.emisionDePlantacion).toHaveBeenCalledWith(PLANTACION, 'Bayka');
  expect(vi.mocked(motor.renderizarReporte).mock.lastCall![0]).toMatchObject(EMISION);
  vi.mocked(leerNombreOrganizacion).mockRejectedValue(new Error('rls'));
  await generarPdfReporte({ arboles: [sinFoto(1)], modo: MODO_REPORTE.conFotos }, contexto());
  expect(motor.emisionDePlantacion).toHaveBeenLastCalledWith(PLANTACION, null);
});

test('los colores de especie son los de la plantación', async () => {
  await generarPdfReporte({ arboles: [sinFoto(1)], modo: MODO_REPORTE.conFotos }, contexto());
  const colorDe = vi.mocked(motor.datosArbolReporte).mock.lastCall![1];
  expect(listarEspeciesDePlantacion).toHaveBeenCalledWith(PLANTACION.id);
  expect(colorDe('ANC')).toBe('#99b95b');
});

test('sin árboles falla antes de leer nada', async () => {
  await expect(
    generarPdfReporte({ arboles: [], modo: MODO_REPORTE.conFotos }, contexto()),
  ).rejects.toThrow(ERROR_REPORTE_SIN_ARBOLES);
  expect(leerNombreOrganizacion).not.toHaveBeenCalled();
  expect(listarEspeciesDePlantacion).not.toHaveBeenCalled();
  expect(motor.renderizarReporte).not.toHaveBeenCalled();
});

test('cuenta las tarjetas que salieron con «Foto no disponible»', async () => {
  vi.mocked(motor.cargarFotos).mockResolvedValue([
    { estado: 'no-disponible' },
    FOTO_LISTA,
    { estado: 'no-disponible' },
  ]);
  const { fotosFallidas } = await generarPdfReporte(
    { arboles: [conFoto(1), conFoto(2), conFoto(3), sinFoto(4)], modo: MODO_REPORTE.conFotos },
    contexto(),
  );
  expect(fotosFallidas).toBe(2);
});

describe('cancelar', () => {
  test('la señal llega a la bajada de fotos', async () => {
    const control = new AbortController();
    await generarPdfReporte(
      { arboles: [conFoto(1)], modo: MODO_REPORTE.conFotos, senal: control.signal },
      contexto(),
    );
    expect(vi.mocked(motor.cargarFotos).mock.lastCall![1]).toMatchObject({
      senal: control.signal,
    });
  });

  test('cancelado durante la bajada de fotos, no arma el PDF', async () => {
    const control = new AbortController();
    vi.mocked(motor.cargarFotos).mockImplementation(async (urls) => {
      control.abort();
      return urls.map(() => FOTO_LISTA);
    });
    const etapas: ProgresoReporte[] = [];
    await expect(
      generarPdfReporte(
        {
          arboles: [conFoto(1)],
          modo: MODO_REPORTE.conFotos,
          senal: control.signal,
          alProgresar: (progreso) => etapas.push(progreso),
        },
        contexto(),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(motor.renderizarReporte).not.toHaveBeenCalled();
    expect(etapas).not.toContainEqual({ etapa: 'armando-pdf' });
  });
});

describe('descargarReportePdf', () => {
  const FILTROS = { parcelaId: 'parc-1', conFoto: true };
  const pedido = (extra = {}) => ({
    filtros: FILTROS,
    modo: MODO_REPORTE.conFotos,
    nombreArchivo: 'arboles-san-sebastian-2025-2026-con-foto.pdf',
    ...extra,
  });

  beforeEach(() => {
    vi.mocked(listarArbolesDelFiltro).mockResolvedValue([conFoto(1), sinFoto(2)]);
  });

  test('lee todo el filtro, arma el PDF y lo descarga con su nombre', async () => {
    const resultado = await descargarReportePdf(pedido(), contexto());
    expect(listarArbolesDelFiltro).toHaveBeenCalledWith(PLANTACION.id, FILTROS, undefined);
    expect(repartoRenderizado()).toEqual({ tarjetas: 1, listado: 1 });
    expect(descargarBlob).toHaveBeenCalledWith(
      BLOB,
      'arboles-san-sebastian-2025-2026-con-foto.pdf',
    );
    expect(resultado).toEqual({ fotosFallidas: 0 });
  });

  test('avisa la lectura antes que las demás etapas', async () => {
    const etapas: ProgresoReporte[] = [];
    await descargarReportePdf(
      pedido({ alProgresar: (p: ProgresoReporte) => etapas.push(p) }),
      contexto(),
    );
    expect(etapas[0]).toEqual({ etapa: 'leyendo-arboles' });
    expect(etapas.at(-1)).toEqual({ etapa: 'armando-pdf' });
  });

  test('la señal llega a la lectura de los árboles y al armado del PDF', async () => {
    const control = new AbortController();
    await descargarReportePdf(pedido({ senal: control.signal }), contexto());
    expect(listarArbolesDelFiltro).toHaveBeenCalledWith(PLANTACION.id, FILTROS, control.signal);
    expect(vi.mocked(motor.renderizarReporte).mock.lastCall![1]).toBe(control.signal);
  });

  test('si el PDF llega justo después de cancelar, no lo descarga', async () => {
    const control = new AbortController();
    vi.mocked(motor.renderizarReporte).mockImplementation(async () => {
      control.abort();
      return BLOB;
    });
    await expect(
      descargarReportePdf(pedido({ senal: control.signal }), contexto()),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(descargarBlob).not.toHaveBeenCalled();
  });

  test('si falla la lectura no descarga nada', async () => {
    vi.mocked(listarArbolesDelFiltro).mockRejectedValue(new Error('red'));
    await expect(descargarReportePdf(pedido(), contexto())).rejects.toThrow('red');
    expect(descargarBlob).not.toHaveBeenCalled();
  });
});
