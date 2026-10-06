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
