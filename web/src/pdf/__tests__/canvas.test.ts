import { exportarYLiberar } from '../canvas';

test('exporta la imagen y deja el canvas en cero para liberar su memoria', () => {
  const toDataURL = vi.fn(() => 'data:image/jpeg;base64,X');
  const canvas = { width: 480, height: 480, toDataURL } as unknown as HTMLCanvasElement;

  expect(exportarYLiberar(canvas, 'image/jpeg', 0.75)).toBe('data:image/jpeg;base64,X');
  expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.75);
  expect([canvas.width, canvas.height]).toEqual([0, 0]);
});
