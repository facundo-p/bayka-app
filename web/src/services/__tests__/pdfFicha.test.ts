import { QueryClient } from '@tanstack/react-query';
import * as motor from '../../pdf/ficha/motorFicha';
import { ESTADO_MAPA, type MapaPdf } from '../../pdf/mapa/estadoMapa';
import { leerArbolParaFicha, leerNombreOrganizacion } from '../../queries/fichasQueries';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { listarPuntosGps, type PuntoGps } from '../../queries/mapaQueries';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { arbolParaFicha, especieDePlantacion, plantacion } from '../../test/fabricas';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import { descargarBlob } from '../descargas';
import { ERROR_FICHA_SIN_ARBOL, descargarFichaPdf, nombreArchivoFicha } from '../pdfFicha';

vi.mock('../../queries/fichasQueries', () => ({
  leerArbolParaFicha: vi.fn(),
  leerNombreOrganizacion: vi.fn(),
}));
vi.mock('../../queries/mapaQueries', () => ({ listarPuntosGps: vi.fn() }));
vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));
vi.mock('../descargas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../descargas')>()),
  descargarBlob: vi.fn(),
}));
vi.mock('../../pdf/ficha/motorFicha', () => ({
  cargarFoto: vi.fn(),
  minimapaDeArbol: vi.fn(),
  datosFicha: vi.fn(),
  emisionDePlantacion: vi.fn(),
  renderizarFicha: vi.fn(),
}));

const PLANTACION = plantacion({ lugar: 'San Sebastián', periodo: '2025-2026' });
const MAPA: MapaPdf = {
  estado: ESTADO_MAPA.listo,
  src: 'data:image/png;base64,M',
  conSatelite: false,
};
const ARBOL = arbolParaFicha({ id: 't1', subId: 'LP12L10ANC23', usuarioRegistro: 'u1' });
const PUNTOS: PuntoGps[] = [];
const BLOB = new Blob(['%PDF']);
const EMISION = {
  encabezado: { logo: '/logo.png', titulo: 'San Sebastián · 2025-2026', detalle: 'SS26' },
  emitido: '12/10/2026',
};
const ANC = especieDePlantacion({ id: 's1', codigo: 'ANC', nombre: 'Anchico', lugarColor: 1 });
const TIM = especieDePlantacion({ id: 's2', codigo: 'TIM', nombre: 'Timbó', lugarColor: 0 });

/** El `colorDe` que recibió el motor, para ver de qué catálogo salió. */
function colorDeRecibido() {
  return vi.mocked(motor.datosFicha).mock.lastCall![1].colorDe;
}

function contexto() {
  return {
    plantacion: PLANTACION,
    nombresUsuario: new Map([['u1', 'Lucía Ferreyra']]),
    queryClient: new QueryClient(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(leerArbolParaFicha).mockResolvedValue(ARBOL);
  vi.mocked(leerNombreOrganizacion).mockResolvedValue('Bayka');
  vi.mocked(listarPuntosGps).mockResolvedValue(PUNTOS);
  vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([ANC, TIM]);
  vi.mocked(motor.cargarFoto).mockResolvedValue({ estado: 'sin-foto' });
  vi.mocked(motor.minimapaDeArbol).mockResolvedValue(MAPA);
  vi.mocked(motor.emisionDePlantacion).mockReturnValue(EMISION);
  vi.mocked(motor.renderizarFicha).mockResolvedValue(BLOB);
});

test('nombre de archivo de la ficha', () => {
  expect(nombreArchivoFicha('San Sebastián', '2025-2026', 'LP12L10ANC23')).toBe(
    'ficha-san-sebastian-2025-2026-lp12l10anc23.pdf',
  );
});

test('la ficha de un árbol lleva su técnico, su foto y su minimapa, y se descarga', async () => {
  await descargarFichaPdf('t1', contexto());

  expect(leerArbolParaFicha).toHaveBeenCalledWith(PLANTACION.id, 't1');
  expect(motor.cargarFoto).toHaveBeenCalledWith(null);
  expect(motor.datosFicha).toHaveBeenCalledWith(ARBOL, {
    tecnico: 'Lucía Ferreyra',
    foto: { estado: 'sin-foto' },
    mapa: MAPA,
    colorDe: expect.any(Function),
  });
  expect(motor.emisionDePlantacion).toHaveBeenCalledWith(PLANTACION, 'Bayka');
  expect(motor.renderizarFicha).toHaveBeenCalledWith(expect.objectContaining(EMISION));
  expect(descargarBlob).toHaveBeenCalledWith(
    BLOB,
    'ficha-san-sebastian-2025-2026-lp12l10anc23.pdf',
  );
});

test('el documento recibe la ficha del árbol', async () => {
  const ficha = { sentinela: 'ficha-t1' } as unknown as ReturnType<typeof motor.datosFicha>;
  vi.mocked(motor.datosFicha).mockReturnValue(ficha);
  await descargarFichaPdf('t1', contexto());
  expect(motor.renderizarFicha).toHaveBeenCalledWith(expect.objectContaining({ ficha }));
});

test('los puntos del mapa salen de la caché del dashboard', async () => {
  const ctx = contexto();
  ctx.queryClient.setQueryData(CLAVE_QUERY.mapa(PLANTACION.id), PUNTOS);
  await descargarFichaPdf('t1', ctx);
  expect(listarPuntosGps).not.toHaveBeenCalled();
});

test('sin organización ni puntos legibles, la ficha sale igual', async () => {
  vi.mocked(leerNombreOrganizacion).mockRejectedValue(new Error('rls'));
  vi.mocked(listarPuntosGps).mockRejectedValue(new Error('red'));
  await descargarFichaPdf('t1', contexto());
  expect(motor.minimapaDeArbol).toHaveBeenCalledWith(ARBOL, [], expect.any(Function));
  expect(motor.emisionDePlantacion).toHaveBeenCalledWith(PLANTACION, null);
  expect(descargarBlob).toHaveBeenCalled();
});

test('si el árbol no llega, falla sin descargar nada', async () => {
  vi.mocked(leerArbolParaFicha).mockResolvedValue(null);
  await expect(descargarFichaPdf('t1', contexto())).rejects.toThrow(ERROR_FICHA_SIN_ARBOL);
  expect(descargarBlob).not.toHaveBeenCalled();
});

test('los colores de especie son los de la plantación, para la ficha y el minimapa', async () => {
  await descargarFichaPdf('t1', contexto());
  expect(listarEspeciesDePlantacion).toHaveBeenCalledWith(PLANTACION.id);
  const colorDe = colorDeRecibido();
  expect(colorDe('TIM')).toBe('#0a3760');
  expect(colorDe('ANC')).toBe('#99b95b');
  expect(vi.mocked(motor.minimapaDeArbol).mock.lastCall![2]).toBe(colorDe);
});

test('sin especies legibles, cada código se pinta por su hash', async () => {
  vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('rls'));
  await descargarFichaPdf('t1', contexto());
  expect(colorDeRecibido()('ANC')).toBe(colorEspeciePorCodigo('ANC'));
  expect(colorDeRecibido()('TIM')).toBe(colorEspeciePorCodigo('TIM'));
  expect(descargarBlob).toHaveBeenCalled();
});
