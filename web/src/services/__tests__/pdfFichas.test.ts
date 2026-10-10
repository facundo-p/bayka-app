import { QueryClient } from '@tanstack/react-query';
import * as motor from '../../pdf/ficha/motorFichas';
import { ESTADO_MAPA, type MapaPdf } from '../../pdf/mapa/estadoMapa';
import { leerNombreOrganizacion, listarArbolesParaFichas } from '../../queries/fichasQueries';
import { listarEspeciesDePlantacion } from '../../queries/especieQueries';
import { listarPuntosGps, type PuntoGps } from '../../queries/mapaQueries';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { arbolParaFicha, plantacion } from '../../test/fabricas';
import { descargarBlob } from '../descargas';
import {
  ERROR_FICHAS_SIN_ARBOLES,
  descargarFichaPdf,
  descargarFichasPdf,
  nombreArchivoFicha,
  nombreArchivoFichas,
} from '../pdfFichas';

vi.mock('../../queries/fichasQueries', () => ({
  listarArbolesParaFichas: vi.fn(),
  leerNombreOrganizacion: vi.fn(),
}));
vi.mock('../../queries/mapaQueries', () => ({ listarPuntosGps: vi.fn() }));
vi.mock('../../queries/especieQueries', () => ({ listarEspeciesDePlantacion: vi.fn() }));
vi.mock('../descargas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../descargas')>()),
  descargarBlob: vi.fn(),
}));
vi.mock('../../pdf/ficha/motorFichas', () => ({
  cargarFotos: vi.fn(),
  minimapaDeArbol: vi.fn(),
  datosFicha: vi.fn(),
  encabezadoDePlantacion: vi.fn(),
  logoNavegador: vi.fn(),
  renderizarFichas: vi.fn(),
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
const ANC = { id: 's1', codigo: 'ANC', nombre: 'Anchico', nombreCientifico: null };
const TIM = { id: 's2', codigo: 'TIM', nombre: 'Timbó', nombreCientifico: null };

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
  vi.mocked(listarArbolesParaFichas).mockResolvedValue([ARBOL]);
  vi.mocked(leerNombreOrganizacion).mockResolvedValue('Bayka');
  vi.mocked(listarPuntosGps).mockResolvedValue(PUNTOS);
  vi.mocked(listarEspeciesDePlantacion).mockResolvedValue([ANC, TIM]);
  vi.mocked(motor.cargarFotos).mockResolvedValue([{ estado: 'sin-foto' }]);
  vi.mocked(motor.minimapaDeArbol).mockResolvedValue(MAPA);
  vi.mocked(motor.logoNavegador).mockReturnValue('/logo.png');
  vi.mocked(motor.renderizarFichas).mockResolvedValue(BLOB);
});

test('nombres de archivo de una ficha y de varias', () => {
  expect(nombreArchivoFicha('San Sebastián', '2025-2026', 'LP12L10ANC23')).toBe(
    'ficha-san-sebastian-2025-2026-lp12l10anc23.pdf',
  );
  expect(nombreArchivoFichas('San Sebastián', '2025-2026')).toBe(
    'fichas-san-sebastian-2025-2026.pdf',
  );
});

test('la ficha de un árbol lleva su técnico, su foto y su minimapa, y se descarga', async () => {
  await descargarFichaPdf('t1', contexto());

  expect(listarArbolesParaFichas).toHaveBeenCalledWith(PLANTACION.id, ['t1']);
  expect(motor.cargarFotos).toHaveBeenCalledWith([null]);
  expect(motor.datosFicha).toHaveBeenCalledWith(ARBOL, {
    tecnico: 'Lucía Ferreyra',
    foto: { estado: 'sin-foto' },
    mapa: MAPA,
    colorDe: expect.any(Function),
  });
  expect(motor.encabezadoDePlantacion).toHaveBeenCalledWith(PLANTACION, 'Bayka', '/logo.png');
  expect(descargarBlob).toHaveBeenCalledWith(
    BLOB,
    'ficha-san-sebastian-2025-2026-lp12l10anc23.pdf',
  );
});

test('varias fichas van a un solo archivo', async () => {
  await descargarFichasPdf(['t1'], contexto());
  expect(descargarBlob).toHaveBeenCalledWith(BLOB, 'fichas-san-sebastian-2025-2026.pdf');
});

test('los minimapas se dibujan de a cuatro como mucho', async () => {
  const arboles = Array.from({ length: 10 }, (_, indice) => arbolParaFicha({ id: `t${indice}` }));
  vi.mocked(listarArbolesParaFichas).mockResolvedValue(arboles);
  vi.mocked(motor.cargarFotos).mockResolvedValue(arboles.map(() => ({ estado: 'sin-foto' })));
  let enVuelo = 0;
  let maximo = 0;
  vi.mocked(motor.minimapaDeArbol).mockImplementation(async () => {
    enVuelo += 1;
    maximo = Math.max(maximo, enVuelo);
    await new Promise((resolver) => setTimeout(resolver, 1));
    enVuelo -= 1;
    return MAPA;
  });
  await descargarFichasPdf(
    arboles.map(({ id }) => id),
    contexto(),
  );
  expect(motor.minimapaDeArbol).toHaveBeenCalledTimes(10);
  expect(maximo).toBe(4);
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
  expect(motor.encabezadoDePlantacion).toHaveBeenCalledWith(PLANTACION, null, '/logo.png');
  expect(descargarBlob).toHaveBeenCalled();
});

test('si el árbol no llega, falla sin descargar nada', async () => {
  vi.mocked(listarArbolesParaFichas).mockResolvedValue([]);
  await expect(descargarFichaPdf('t1', contexto())).rejects.toThrow(ERROR_FICHAS_SIN_ARBOLES);
  expect(descargarBlob).not.toHaveBeenCalled();
});

test('los colores de especie son los de la plantación, para la ficha y el minimapa', async () => {
  await descargarFichaPdf('t1', contexto());
  expect(listarEspeciesDePlantacion).toHaveBeenCalledWith(PLANTACION.id);
  const colorDe = colorDeRecibido();
  expect(colorDe('ANC')).not.toBe(colorDe('TIM'));
  expect(vi.mocked(motor.minimapaDeArbol).mock.lastCall![2]).toBe(colorDe);
});

test('sin especies legibles, la ficha sale igual', async () => {
  vi.mocked(listarEspeciesDePlantacion).mockRejectedValue(new Error('rls'));
  await descargarFichaPdf('t1', contexto());
  expect(descargarBlob).toHaveBeenCalled();
});
