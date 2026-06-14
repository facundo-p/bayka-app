/**
 * Geometría del recorte de foto (#167). Funciones puras y testeables que mapean
 * el box de recorte (en coordenadas de pantalla) a píxeles de la imagen original.
 */

export interface Rect { x: number; y: number; w: number; h: number; }
export interface PixelCrop { originX: number; originY: number; width: number; height: number; }
export type Corner = 'tl' | 'tr' | 'bl' | 'br';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Rectángulo donde se dibuja la imagen con `resizeMode="contain"` dentro de un
 * stage de `stageW × stageH` (centrada, con letterbox).
 */
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

/** Mueve el box `dx/dy` clampeado para no salirse del rectángulo de la imagen. */
export function moveBox(start: Rect, dx: number, dy: number, disp: Rect): Rect {
  const x = clamp(start.x + dx, disp.x, disp.x + disp.w - start.w);
  const y = clamp(start.y + dy, disp.y, disp.y + disp.h - start.h);
  return { x, y, w: start.w, h: start.h };
}

/** Reposiciona una esquina del box, clampeada a la imagen y con tamaño mínimo. */
export function resizeCorner(start: Rect, corner: Corner, dx: number, dy: number, disp: Rect, min: number): Rect {
  const left = start.x;
  const top = start.y;
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  const dispRight = disp.x + disp.w;
  const dispBottom = disp.y + disp.h;

  if (corner === 'tl') {
    const nx = clamp(left + dx, disp.x, right - min);
    const ny = clamp(top + dy, disp.y, bottom - min);
    return { x: nx, y: ny, w: right - nx, h: bottom - ny };
  }
  if (corner === 'tr') {
    const nr = clamp(right + dx, left + min, dispRight);
    const ny = clamp(top + dy, disp.y, bottom - min);
    return { x: left, y: ny, w: nr - left, h: bottom - ny };
  }
  if (corner === 'bl') {
    const nx = clamp(left + dx, disp.x, right - min);
    const nb = clamp(bottom + dy, top + min, dispBottom);
    return { x: nx, y: top, w: right - nx, h: nb - top };
  }
  // br
  const nr = clamp(right + dx, left + min, dispRight);
  const nb = clamp(bottom + dy, top + min, dispBottom);
  return { x: left, y: top, w: nr - left, h: nb - top };
}

/** Convierte el box (coords del stage) a un recorte en píxeles de la imagen. */
export function cropBoxToPixels(box: Rect, disp: Rect, imgW: number, imgH: number): PixelCrop {
  const scale = imgW / disp.w; // disp.w mapea a imgW (contain conserva aspecto)
  const relX = Math.max(0, box.x - disp.x);
  const relY = Math.max(0, box.y - disp.y);
  const originX = clamp(Math.round(relX * scale), 0, Math.max(0, imgW - 1));
  const originY = clamp(Math.round(relY * scale), 0, Math.max(0, imgH - 1));
  const width = clamp(Math.round(box.w * scale), 1, imgW - originX);
  const height = clamp(Math.round(box.h * scale), 1, imgH - originY);
  return { originX, originY, width, height };
}

/** true si el box cubre (casi) toda la imagen → no hace falta recortar. */
export function isFullCrop(box: Rect, disp: Rect, epsilon = 2): boolean {
  return (
    box.x <= disp.x + epsilon &&
    box.y <= disp.y + epsilon &&
    box.x + box.w >= disp.x + disp.w - epsilon &&
    box.y + box.h >= disp.y + disp.h - epsilon
  );
}
