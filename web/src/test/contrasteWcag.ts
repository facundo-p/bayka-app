/** Mínimo de WCAG AA para texto de tamaño normal. */
export const CONTRASTE_AA_TEXTO = 4.5;

type Rgba = [number, number, number, number];

/** `#rrggbb` o `rgba(r, g, b, a)`; los canales en 0–255 y el alfa en 0–1. */
function aRgba(color: string): Rgba {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const canales = /rgba?\(([^)]+)\)/.exec(color)?.[1].split(',').map(Number);
  if (!canales || canales.some(Number.isNaN)) throw new Error(`Color no soportado: ${color}`);
  const [r, g, b, a = 1] = canales;
  return [r, g, b, a];
}

function canalLineal(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia([r, g, b]: Rgba): number {
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

/** Un color translúcido pintado sobre un fondo opaco. */
function sobre([r, g, b, a]: Rgba, fondo: Rgba): Rgba {
  const mezcla = (frente: number, atras: number) => a * frente + (1 - a) * atras;
  return [mezcla(r, fondo[0]), mezcla(g, fondo[1]), mezcla(b, fondo[2]), 1];
}

/** Relación de contraste WCAG 2 de `texto` sobre `fondo` (opaco). */
export function contraste(texto: string, fondo: string): number {
  const atras = aRgba(fondo);
  const [clara, oscura] = [luminancia(sobre(aRgba(texto), atras)), luminancia(atras)].sort(
    (x, y) => y - x,
  );
  return (clara + 0.05) / (oscura + 0.05);
}
