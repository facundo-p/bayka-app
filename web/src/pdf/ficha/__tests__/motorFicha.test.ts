import { ESTADO_FOTO, type FotoPdf } from '../../estadoFoto';
import { cargarFotos } from '../../fotos';
import { cargarFoto } from '../motorFicha';
import { MEDIDA_FOTO_FICHA } from '../rasterFicha';

vi.mock('../../plantilla/recursosNavegador', async () => {
  const recursos = await import('../../../test/pdfNode');
  return {
    archivosFuentesNavegador: () => recursos.FUENTES_NODE,
    logoNavegador: () => recursos.LOGO_NODE,
  };
});
vi.mock('../../fotos', () => ({ cargarFotos: vi.fn() }));

const FOTO: FotoPdf = { estado: ESTADO_FOTO.lista, src: 'data:image/jpeg;base64,AAA' };

test('la foto de la ficha se reduce a la medida de la ficha', async () => {
  vi.mocked(cargarFotos).mockResolvedValue([FOTO]);
  expect(await cargarFoto('p/a.jpg')).toBe(FOTO);
  expect(cargarFotos).toHaveBeenCalledWith(['p/a.jpg'], { medida: MEDIDA_FOTO_FICHA });
});
