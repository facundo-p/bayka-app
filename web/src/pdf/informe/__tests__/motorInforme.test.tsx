// @vitest-environment node
// El motor del navegador con las fuentes y el logo de node, y el canvas simulado.
import { opcionesCon } from '../../../lib/opcionesInforme';
import { entradaInforme } from '../../../test/informePdf';
import { LOGO_NODE, PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_MAPA } from '../../mapa/estadoMapa';
import { encabezadoDePlantacion } from '../../plantilla/textos';
import { dibujarMapaInforme } from '../mapaInforme';
import { renderizarInforme } from '../motorInforme';
import { planificarInforme } from '../planificarInforme';

vi.mock('../../plantilla/textoLargo', () => ({ CORTAR_TEXTO_LARGO: false }));
vi.mock('../../plantilla/recursosNavegador', async () => {
  const recursos = await import('../../../test/pdfNode');
  return {
    archivosFuentesNavegador: () => recursos.FUENTES_NODE,
    logoNavegador: () => recursos.LOGO_NODE,
  };
});
vi.mock('../mapaInforme', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../mapaInforme')>()),
  dibujarMapaInforme: vi.fn(),
}));
vi.mock('../planificarInforme', async (importOriginal) => {
  const original = await importOriginal<typeof import('../planificarInforme')>();
  return { ...original, planificarInforme: vi.fn(original.planificarInforme) };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dibujarMapaInforme).mockResolvedValue({
    mapa: { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite: false },
  });
});

const textosDe = async (blob: Blob) => textosDelPdf(Buffer.from(await blob.arrayBuffer()));

const EMISION = {
  encabezado: encabezadoDePlantacion({ lugar: 'San Sebastián', periodo: '2025-2026' }, LOGO_NODE),
  emitido: '06/10/2026',
};

test('dibuja el mapa con los puntos de la plantación y arma el PDF', async () => {
  const blob = await renderizarInforme({
    ...entradaInforme({ parcelas: 4, especies: 4 }),
    ...EMISION,
  });
  const [contenido] = vi.mocked(dibujarMapaInforme).mock.calls[0];
  expect(contenido.puntos).toHaveLength(12);
  expect(planificarInforme).toHaveBeenCalledTimes(1);
  expect(await textosDe(blob)).toEqual(
    expect.arrayContaining(['Puntos GPS por especie', 'San Sebastián · 2025-2026']),
  );
});

test('sin GPS no dibuja mapa y el informe sale igual', async () => {
  const blob = await renderizarInforme({
    ...entradaInforme({ parcelas: 2, especies: 2, conGps: false }),
    ...EMISION,
  });
  expect(dibujarMapaInforme).not.toHaveBeenCalled();
  expect(await textosDe(blob)).toContain('Distribución por especie · 2 especies');
});

test('sin el mapa elegido no planifica ni dibuja, y el informe sale sin ese bloque', async () => {
  const blob = await renderizarInforme({
    ...entradaInforme({ parcelas: 4, especies: 4, opciones: opcionesCon(['gps', 'foto', 'meta']) }),
    ...EMISION,
  });
  expect(planificarInforme).not.toHaveBeenCalled();
  expect(dibujarMapaInforme).not.toHaveBeenCalled();
  const textos = await textosDe(blob);
  expect(textos).toContain('CON GPS');
  expect(textos).not.toContain('Puntos GPS por especie');
});

// Si el motor midiera sin las fuentes leídas, los textos irían en un renglón y el plan no los contaría.
test('parte los textos largos con las fuentes leídas, y planifica con esos renglones', async () => {
  const blob = await renderizarInforme({
    ...entradaInforme({ parcelas: 4, especies: 3, largos: true, codigosLargos: true }),
    ...EMISION,
  });
  const [modelo] = vi.mocked(planificarInforme).mock.calls[0];
  const [primera] = modelo.especies.filas;
  const [codigo] = modelo.mapa.leyenda;
  for (const partido of [modelo.linea, primera.titulo, codigo.texto]) {
    expect(partido.length).toBeGreaterThan(1);
  }
  const textos = await textosDe(blob);
  expect(textos).toEqual(expect.arrayContaining([...modelo.linea, ...primera.titulo]));
  expect(textos.some((texto) => texto.endsWith('…'))).toBe(false);
});
