import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardia de la escala documentada en el bloque Layout de `theme.css` (#359).
 *
 * Antes de esto había 7 media queries ad hoc en 59 archivos (900, 1200, 760) y
 * ninguna capa por debajo de 900. Cada breakpoint suelto es un ancho más donde
 * nadie mide nada. Los valores no pueden salir de una custom property —var() no
 * se resuelve en el prelude de una at-rule—, así que la única forma de que la
 * escala signifique algo es un test que la haga cumplir.
 */
const ANCHOS_VALIDOS = [1400, 1200, 900, 600];
const ALTOS_VALIDOS = [760];

// vitest corre con cwd en `web/`; los .css que importan son todos los de src/.
const RAIZ = join(process.cwd(), 'src');

function archivosCss(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) return archivosCss(ruta);
    return entrada.name.endsWith('.css') ? [ruta] : [];
  });
}

const CSS = archivosCss(RAIZ).map((ruta) => ({
  ruta: ruta.slice(RAIZ.length),
  texto: readFileSync(ruta, 'utf8'),
}));

/** Lo que `revisar` objete del prelude de cada `@media`, con el archivo adelante. */
function hallazgosEnMedia(revisar: (prelude: string) => string[]): string[] {
  return CSS.flatMap(({ ruta, texto }) =>
    [...texto.matchAll(/@media[^{]+/g)].flatMap(([prelude]) =>
      revisar(prelude).map((hallazgo) => `${ruta}: ${hallazgo}`),
    ),
  );
}

function valoresPx(prelude: string, feature: string): number[] {
  const patron = new RegExp(`\\(\\s*${feature}:\\s*(\\d+)px\\s*\\)`, 'g');
  return [...prelude.matchAll(patron)].map(([, valor]) => Number(valor));
}

// min-* partiría la escala en dos direcciones: la app es desktop-first.
function fueraDeEscala(dimension: string, validos: number[]) {
  return (prelude: string) => [
    ...valoresPx(prelude, `max-${dimension}`)
      .filter((valor) => !validos.includes(valor))
      .map((valor) => `${valor}px`),
    ...valoresPx(prelude, `min-${dimension}`).map(
      (valor) => `min-${dimension} ${valor}px (la escala es desktop-first)`,
    ),
  ];
}

// La promesa es "falla si aparece cualquier otro número". Un `64em` o la sintaxis
// de rango `(width <= 1024px)` pasarían sin ruido por los chequeos de escala.
function sintaxisIlegible(prelude: string): string[] {
  const hallazgos: string[] = [];
  if (/\d\s*(em|rem|ch|vw|vh|pt|%)\s*\)/.test(prelude)) {
    hallazgos.push(`unidad no-px en ${prelude.trim()}`);
  }
  if (/(width|height)\s*[<>]=?/.test(prelude)) {
    hallazgos.push(`sintaxis de rango en ${prelude.trim()}`);
  }
  return hallazgos;
}

describe('escala de breakpoints', () => {
  it('encuentra los .css del proyecto', () => {
    expect(CSS.length).toBeGreaterThan(20);
  });

  it('no usa ningún ancho fuera de la escala', () => {
    expect(hallazgosEnMedia(fueraDeEscala('width', ANCHOS_VALIDOS))).toEqual([]);
  });

  it('no usa unidades ni sintaxis que el test no sabe leer', () => {
    expect(hallazgosEnMedia(sintaxisIlegible)).toEqual([]);
  });

  it('no usa ningún alto fuera de la escala', () => {
    expect(hallazgosEnMedia(fueraDeEscala('height', ALTOS_VALIDOS))).toEqual([]);
  });
});

describe('grillas', () => {
  /**
   * Un track `1fr` es `minmax(auto, 1fr)`: no baja de su min-content, se queda
   * con más de lo que le toca y la fila desborda en vez de elidir. Es la causa
   * de tres bugs medidos (#357, #359), así que va como invariante.
   */
  it('ningún track flexible sin piso en 0', () => {
    const fuera = CSS.flatMap(({ ruta, texto }) =>
      [...texto.matchAll(/grid-template(?:-columns|-rows)?:[^;}]+/g)]
        .map(([linea]) => linea)
        .filter((linea) => linea.includes('fr'))
        // `repeat(auto-fit, minmax(Npx, 1fr))` ya trae su propio piso.
        .filter(
          (linea) =>
            !/minmax\(\s*0(px)?\s*,/.test(linea) &&
            !/repeat\(\s*auto-(fit|fill)\s*,\s*minmax\(/.test(linea),
        )
        .map((linea) => `${ruta}: ${linea.replace(/\s+/g, ' ')}`),
    );
    expect(fuera).toEqual([]);
  });
});
