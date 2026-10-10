// @vitest-environment node
// El motor del navegador con las fuentes y el logo de node, y el canvas simulado.
import { entradaInforme } from '../../../test/informePdf';
import { PNG_DE_PRUEBA } from '../../../test/pdfNode';
import { textosDelPdf } from '../../../test/textoPdf';
import { ESTADO_MAPA } from '../../mapa/estadoMapa';
import { CAJA_MAPA_INFORME } from '../../plantilla/tokens';
import { dibujarMapaInforme } from '../mapaInforme';
import { renderizarInforme } from '../motorInforme';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dibujarMapaInforme).mockResolvedValue({
    mapa: { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite: false },
    caja: CAJA_MAPA_INFORME,
  });
});

const textosDe = async (blob: Blob) => textosDelPdf(Buffer.from(await blob.arrayBuffer()));

test('dibuja el mapa con los puntos de la plantación y arma el PDF', async () => {
  const blob = await renderizarInforme({
    ...entradaInforme({ parcelas: 4, especies: 4 }),
    emitido: '06/10/2026',
  });
  const [contenido] = vi.mocked(dibujarMapaInforme).mock.calls[0];
  expect(contenido.puntos).toHaveLength(12);
  expect(await textosDe(blob)).toContain('Total · 4 parcelas');
});

test('sin GPS no dibuja mapa y el informe sale igual', async () => {
  const blob = await renderizarInforme({
    ...entradaInforme({ parcelas: 2, especies: 2, conGps: false }),
    emitido: '06/10/2026',
  });
  expect(dibujarMapaInforme).not.toHaveBeenCalled();
  expect(await textosDe(blob)).toContain('Total · 2 parcelas');
});
