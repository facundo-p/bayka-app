import {
  cameraFrame,
  computeDisplayRect,
  cornerPoint,
  cropBoxToPixels,
  largestCenteredSquare,
  maskRects,
  moveBox,
  resizeCorner,
} from '../../src/utils/cropGeometry';

describe('cropGeometry (#167, #831)', () => {
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

  describe('largestCenteredSquare', () => {
    test('rectángulo vertical → cuadrado del ancho, centrado en alto', () => {
      expect(largestCenteredSquare({ x: 0, y: 10, w: 300, h: 400 })).toEqual({ x: 0, y: 60, w: 300, h: 300 });
    });
    test('rectángulo horizontal → cuadrado del alto, centrado en ancho', () => {
      expect(largestCenteredSquare({ x: 0, y: 100, w: 400, h: 200 })).toEqual({ x: 100, y: 100, w: 200, h: 200 });
    });
  });

  describe('cameraFrame (marco del visor)', () => {
    test('teléfono vertical → cuadrado del ancho, centrado en el preview 3:4', () => {
      expect(cameraFrame(400, 900)).toEqual({ x: 0, y: 250, w: 400, h: 400 });
    });
    test('coincide con el cuadrado inicial del recorte de la foto 3:4 mostrada igual', () => {
      const view = { w: 360, h: 800 };
      const fotoMostrada = computeDisplayRect(3000, 4000, view.w, view.h);
      expect(cameraFrame(view.w, view.h)).toEqual(largestCenteredSquare(fotoMostrada));
    });
  });

  describe('cropBoxToPixels (siempre cuadrado)', () => {
    const disp = { x: 0, y: 100, w: 400, h: 200 }; // imagen 2000x1000 escala x5
    test('cuadrado centrado más grande → cuadrado del alto', () => {
      const px = cropBoxToPixels(largestCenteredSquare(disp), disp, 2000, 1000);
      expect(px).toEqual({ originX: 500, originY: 0, width: 1000, height: 1000 });
    });
    test('cuadrante superior izquierdo', () => {
      const px = cropBoxToPixels({ x: 0, y: 100, w: 100, h: 100 }, disp, 2000, 1000);
      expect(px).toEqual({ originX: 0, originY: 0, width: 500, height: 500 });
    });
    test('pegado al borde: corre el origen para no salirse y sigue cuadrado', () => {
      const px = cropBoxToPixels({ x: 350, y: 250, w: 100, h: 100 }, disp, 2000, 1000);
      expect(px).toEqual({ originX: 1500, originY: 500, width: 500, height: 500 });
    });
    test('escala no entera: ancho y alto iguales', () => {
      const d = computeDisplayRect(3024, 4032, 393, 700);
      const px = cropBoxToPixels(largestCenteredSquare(d), d, 3024, 4032);
      expect(px.width).toBe(px.height);
      expect(px.originY + px.height).toBeLessThanOrEqual(4032);
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

  describe('resizeCorner (aspecto 1:1 bloqueado)', () => {
    const disp = { x: 0, y: 0, w: 400, h: 400 };
    const start = { x: 100, y: 100, w: 200, h: 200 };
    test('br agranda', () => {
      expect(resizeCorner(start, 'br', 50, 50, disp, 40)).toEqual({ x: 100, y: 100, w: 250, h: 250 });
    });
    test('tl achica respetando la esquina opuesta', () => {
      expect(resizeCorner(start, 'tl', 50, 50, disp, 40)).toEqual({ x: 150, y: 150, w: 150, h: 150 });
    });
    test('tr y bl anclan la esquina opuesta', () => {
      expect(resizeCorner(start, 'tr', 20, -20, disp, 40)).toEqual({ x: 100, y: 80, w: 220, h: 220 });
      expect(resizeCorner(start, 'bl', -20, 20, disp, 40)).toEqual({ x: 80, y: 100, w: 220, h: 220 });
    });
    test('arrastre solo horizontal también da un cuadrado', () => {
      const r = resizeCorner(start, 'br', 100, 0, disp, 40);
      expect(r.w).toBe(r.h);
      expect(r).toEqual({ x: 100, y: 100, w: 250, h: 250 });
    });
    test('respeta tamaño mínimo', () => {
      expect(resizeCorner(start, 'br', -500, -500, disp, 40)).toEqual({ x: 100, y: 100, w: 40, h: 40 });
    });
    test('topa con el lado más cercano de la imagen y sigue cuadrado', () => {
      const ancha = { x: 0, y: 0, w: 400, h: 300 };
      expect(resizeCorner({ x: 50, y: 50, w: 100, h: 100 }, 'br', 999, 999, ancha, 40))
        .toEqual({ x: 50, y: 50, w: 250, h: 250 });
    });
    test('tl topa con el borde superior izquierdo', () => {
      expect(resizeCorner({ x: 50, y: 50, w: 100, h: 100 }, 'tl', -999, -999, disp, 40))
        .toEqual({ x: 0, y: 0, w: 150, h: 150 });
    });
  });

  describe('cornerPoint', () => {
    const box = { x: 10, y: 20, w: 100, h: 100 };
    test('ubica cada esquina', () => {
      expect(cornerPoint(box, 'tl')).toEqual({ x: 10, y: 20 });
      expect(cornerPoint(box, 'tr')).toEqual({ x: 110, y: 20 });
      expect(cornerPoint(box, 'bl')).toEqual({ x: 10, y: 120 });
      expect(cornerPoint(box, 'br')).toEqual({ x: 110, y: 120 });
    });
  });

  describe('maskRects', () => {
    test('cuatro bandas que cubren todo menos el box', () => {
      const rects = maskRects({ x: 0, y: 250, w: 400, h: 400 }, { w: 400, h: 900 });
      expect(rects).toEqual([
        { x: 0, y: 0, w: 400, h: 250 },
        { x: 0, y: 650, w: 400, h: 250 },
        { x: 0, y: 250, w: 0, h: 400 },
        { x: 400, y: 250, w: 0, h: 400 },
      ]);
    });
  });
});
