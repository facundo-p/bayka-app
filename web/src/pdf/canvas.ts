/** Canvas fuera del DOM para rasterizar mapas y fotos antes de pasarlos al PDF. */
export function crearCanvas(ancho: number, alto: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho);
  canvas.height = Math.round(alto);
  return canvas;
}

export function contexto2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const contexto = canvas.getContext('2d');
  if (!contexto) throw new Error('El navegador no permite dibujar en canvas');
  return contexto;
}

/**
 * Exporta y libera: el navegador retiene la memoria del canvas hasta que lo
 * achica, y con N fichas se acumulan N mapas y N fotos.
 */
export function exportarYLiberar(
  canvas: HTMLCanvasElement,
  tipo: string,
  calidad?: number,
): string {
  const dataUrl = canvas.toDataURL(tipo, calidad);
  liberarCanvas(canvas);
  return dataUrl;
}

/** Achicarlo a cero es la única forma de que el navegador suelte su memoria. */
export function liberarCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
