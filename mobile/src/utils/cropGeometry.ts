/** Geometría del recorte cuadrado de fotos (#831): funciones puras sobre coords de pantalla y píxeles de la imagen. */

export interface Rect { x: number; y: number; w: number; h: number; }
export interface Point { x: number; y: number; }
export interface Size { w: number; h: number; }
export interface PixelCrop { originX: number; originY: number; width: number; height: number; }

type Sign = -1 | 1;

/** Hacia dónde crece el box al arrastrar cada esquina; la opuesta queda fija. */
const CORNER_SIGN = {
  tl: { x: -1, y: -1 },
  tr: { x: 1, y: -1 },
  bl: { x: -1, y: 1 },
  br: { x: 1, y: 1 },
} as const satisfies Record<string, { x: Sign; y: Sign }>;

export type Corner = keyof typeof CORNER_SIGN;
export const CORNERS = Object.keys(CORNER_SIGN) as Corner[];

/**
 * Preview de la cámara: 4:3 del sensor, entero (sin recortar) en la vista.
 * Con el teléfono vertical la foto sale 3:4, de ahí el ancho sobre alto.
 * Vale para Android con la vista en vertical: en iOS `ratio` no existe y el preview es aspect-fill.
 */
export const CAMERA_PREVIEW = { ratio: '4:3', anchoSobreAlto: 3 / 4 } as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rectángulo donde se dibuja la imagen con `resizeMode="contain"` dentro de un stage de `stageW × stageH` (centrada, con letterbox). */
export function computeDisplayRect(imgW: number, imgH: number, stageW: number, stageH: number): Rect {
  if (imgW <= 0 || imgH <= 0 || stageW <= 0 || stageH <= 0) {
    return { x: 0, y: 0, w: stageW, h: stageH };
  }
  const imgAspect = imgW / imgH;
  const stageAspect = stageW / stageH;
  if (imgAspect > stageAspect) {
    const w = stageW;
    const h = stageW / imgAspect;
    return { x: 0, y: (stageH - h) / 2, w, h };
  }
  const h = stageH;
  const w = stageH * imgAspect;
  return { x: (stageW - w) / 2, y: 0, w, h };
}

export function largestCenteredSquare(rect: Rect): Rect {
  const side = Math.min(rect.w, rect.h);
  return { x: rect.x + (rect.w - side) / 2, y: rect.y + (rect.h - side) / 2, w: side, h: side };
}

/** Marco del visor: el cuadrado centrado más grande del preview, el mismo con que arranca el recorte. */
export function cameraFrame(viewW: number, viewH: number): Rect {
  const { anchoSobreAlto } = CAMERA_PREVIEW;
  return largestCenteredSquare(computeDisplayRect(anchoSobreAlto, 1, viewW, viewH));
}

/** Mueve el box `dx/dy` clampeado para no salirse del rectángulo de la imagen. */
export function moveBox(start: Rect, dx: number, dy: number, disp: Rect): Rect {
  const x = clamp(start.x + dx, disp.x, disp.x + disp.w - start.w);
  const y = clamp(start.y + dy, disp.y, disp.y + disp.h - start.h);
  return { x, y, w: start.w, h: start.h };
}

export function cornerPoint(box: Rect, corner: Corner): Point {
  const sign = CORNER_SIGN[corner];
  return { x: sign.x > 0 ? box.x + box.w : box.x, y: sign.y > 0 ? box.y + box.h : box.y };
}

function oppositeCorner(corner: Corner): Corner {
  const sign = CORNER_SIGN[corner];
  return CORNERS.find((c) => CORNER_SIGN[c].x === -sign.x && CORNER_SIGN[c].y === -sign.y)!;
}

/** Lado máximo que entra en la imagen creciendo desde `anchor` hacia `sign`. */
function maxSideFrom(anchor: Point, sign: { x: Sign; y: Sign }, disp: Rect): number {
  const w = sign.x > 0 ? disp.x + disp.w - anchor.x : anchor.x - disp.x;
  const h = sign.y > 0 ? disp.y + disp.h - anchor.y : anchor.y - disp.y;
  return Math.min(w, h);
}

/**
 * Arrastra una esquina del box cuadrado con la opuesta fija. El lado sigue al
 * promedio de los dos desplazamientos, así el box no deja de ser cuadrado.
 */
export function resizeCorner(start: Rect, corner: Corner, dx: number, dy: number, disp: Rect, min: number): Rect {
  const sign = CORNER_SIGN[corner];
  const anchor = cornerPoint(start, oppositeCorner(corner));
  const max = maxSideFrom(anchor, sign, disp);
  const side = clamp(start.w + (sign.x * dx + sign.y * dy) / 2, Math.min(min, max), max);
  return {
    x: sign.x > 0 ? anchor.x : anchor.x - side,
    y: sign.y > 0 ? anchor.y : anchor.y - side,
    w: side,
    h: side,
  };
}

/** Convierte el box (coords del stage) a un recorte cuadrado en píxeles, siempre dentro de la imagen. */
export function cropBoxToPixels(box: Rect, disp: Rect, imgW: number, imgH: number): PixelCrop {
  const scale = imgW / disp.w; // contain conserva el aspecto: la escala es la misma en los dos ejes
  const side = clamp(Math.round(box.w * scale), 1, Math.min(imgW, imgH));
  const originX = clamp(Math.round(Math.max(0, box.x - disp.x) * scale), 0, imgW - side);
  const originY = clamp(Math.round(Math.max(0, box.y - disp.y) * scale), 0, imgH - side);
  return { originX, originY, width: side, height: side };
}

/** Las cuatro bandas del stage que quedan fuera del box (arriba, abajo, izquierda, derecha). */
export function maskRects(box: Rect, stage: Size): Rect[] {
  const bottom = box.y + box.h;
  const right = box.x + box.w;
  return [
    { x: 0, y: 0, w: stage.w, h: box.y },
    { x: 0, y: bottom, w: stage.w, h: Math.max(0, stage.h - bottom) },
    { x: 0, y: box.y, w: box.x, h: box.h },
    { x: right, y: box.y, w: Math.max(0, stage.w - right), h: box.h },
  ];
}

/** Rect → estilo de posición absoluta. */
export function rectToLayout(rect: Rect) {
  return { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
}
