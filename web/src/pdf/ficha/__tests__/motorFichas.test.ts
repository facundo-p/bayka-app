import { cargarFotos as cargarFotosPdf } from '../../fotos';
import { cargarFotos } from '../motorFichas';
import { MEDIDA_FOTO_FICHA } from '../rasterFicha';

vi.mock('../../plantilla/recursosNavegador', async () => {
  const recursos = await import('../../../test/pdfNode');
  return {
    archivosFuentesNavegador: () => recursos.FUENTES_NODE,
    logoNavegador: () => recursos.LOGO_NODE,
  };
});
vi.mock('../../fotos', () => ({ cargarFotos: vi.fn(async () => []) }));

test('las fotos de la ficha se reducen a la medida de la ficha', async () => {
  await cargarFotos(['p/a.jpg', null]);
  expect(cargarFotosPdf).toHaveBeenCalledWith(['p/a.jpg', null], { medida: MEDIDA_FOTO_FICHA });
});
