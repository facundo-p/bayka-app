import {
  computeDisplayRect,
  cropBoxToPixels,
  isFullCrop,
  moveBox,
  resizeCorner,
} from '../../src/utils/cropGeometry';

describe('cropGeometry (#167)', () => {
  describe('computeDisplayRect (contain fit)', () => {
    test('imagen más ancha que el stage → letterbox arriba/abajo', () => {
      const r = computeDisplayRect(2000, 1000, 400, 400); // aspect 2 vs 1
      expect(r).toEqual({ x: 0, y: 100, w: 400, h: 200 });
    });
    test('imagen más alta que el stage → letterbox a los lados', () => {
      const r = computeDisplayRect(1000, 2000, 400, 400); // aspect .5 vs 1
      expect(r).toEqual({ x: 100, y: 0, w: 200, h: 400 });
    });
    test('dimensiones inválidas → cubre el stage', () => {
      expect(computeDisplayRect(0, 0, 300, 500)).toEqual({ x: 0, y: 0, w: 300, h: 500 });
    });
  });

  describe('cropBoxToPixels', () => {
    const disp = { x: 0, y: 100, w: 400, h: 200 }; // imagen 2000x1000 escala x5
    test('box completo → recorte de imagen completa', () => {
      const px = cropBoxToPixels(disp, disp, 2000, 1000);
      expect(px).toEqual({ originX: 0, originY: 0, width: 2000, height: 1000 });
    });
    test('cuadrante superior izquierdo', () => {
      const box = { x: 0, y: 100, w: 200, h: 100 };
      const px = cropBoxToPixels(box, disp, 2000, 1000);
      expect(px).toEqual({ originX: 0, originY: 0, width: 1000, height: 500 });
    });
    test('clampa dentro de la imagen', () => {
      const box = { x: 350, y: 250, w: 100, h: 100 }; // se pasa del borde
      const px = cropBoxToPixels(box, disp, 2000, 1000);
      expect(px.originX + px.width).toBeLessThanOrEqual(2000);
      expect(px.originY + px.height).toBeLessThanOrEqual(1000);
    });
  });

  describe('isFullCrop', () => {
    const disp = { x: 10, y: 20, w: 300, h: 400 };
    test('box == display → true', () => {
      expect(isFullCrop({ ...disp }, disp)).toBe(true);
    });
    test('box recortado → false', () => {
      expect(isFullCrop({ x: 50, y: 60, w: 100, h: 100 }, disp)).toBe(false);
    });
  });

  describe('moveBox', () => {
    const disp = { x: 0, y: 0, w: 400, h: 400 };
    test('mueve dentro de límites', () => {
      expect(moveBox({ x: 50, y: 50, w: 100, h: 100 }, 20, 30, disp))
        .toEqual({ x: 70, y: 80, w: 100, h: 100 });
    });
    test('clampa al borde', () => {
      expect(moveBox({ x: 350, y: 350, w: 100, h: 100 }, 100, 100, disp))
        .toEqual({ x: 300, y: 300, w: 100, h: 100 });
    });
  });

  describe('resizeCorner', () => {
    const disp = { x: 0, y: 0, w: 400, h: 400 };
    const start = { x: 100, y: 100, w: 200, h: 200 };
    test('br agranda', () => {
      expect(resizeCorner(start, 'br', 50, 50, disp, 40))
        .toEqual({ x: 100, y: 100, w: 250, h: 250 });
    });
    test('tl achica respetando esquina opuesta', () => {
      expect(resizeCorner(start, 'tl', 50, 50, disp, 40))
        .toEqual({ x: 150, y: 150, w: 150, h: 150 });
    });
    test('respeta tamaño mínimo', () => {
      const r = resizeCorner(start, 'br', -500, -500, disp, 40);
      expect(r.w).toBe(40);
      expect(r.h).toBe(40);
    });
    test('clampa al borde de la imagen', () => {
      const r = resizeCorner(start, 'br', 999, 999, disp, 40);
      expect(r.x + r.w).toBe(400);
      expect(r.y + r.h).toBe(400);
    });
  });
});
