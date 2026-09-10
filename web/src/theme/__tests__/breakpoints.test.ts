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

describe('escala de breakpoints', () => {
  it('encuentra los .css del proyecto', () => {
    expect(CSS.length).toBeGreaterThan(20);
  });

  it('no usa ningún ancho fuera de la escala', () => {
    const fuera: string[] = [];
    for (const { ruta, texto } of CSS) {
      for (const [, valor] of texto.matchAll(/@media[^{]*?\(\s*max-width:\s*(\d+)px\s*\)/g)) {
        if (!ANCHOS_VALIDOS.includes(Number(valor))) fuera.push(`${ruta}: ${valor}px`);
      }
      // min-width partiría la escala en dos direcciones: la app es desktop-first.
      for (const [, valor] of texto.matchAll(/@media[^{]*?\(\s*min-width:\s*(\d+)px\s*\)/g)) {
        fuera.push(`${ruta}: min-width ${valor}px (la escala es desktop-first)`);
      }
    }
    expect(fuera).toEqual([]);
  });

  it('no usa unidades ni sintaxis que el test no sabe leer', () => {
    // La promesa es "falla si aparece cualquier otro número". Un `64em` o la
    // sintaxis de rango `(width <= 1024px)` pasarían sin ruido por los tests de
    // arriba, así que se prohíben de entrada.
    const fuera: string[] = [];
    for (const { ruta, texto } of CSS) {
      for (const [prelude] of texto.matchAll(/@media[^{]+/g)) {
        if (/\d\s*(em|rem|ch|vw|vh|pt|%)\s*\)/.test(prelude)) {
          fuera.push(`${ruta}: unidad no-px en ${prelude.trim()}`);
        }
        if (/(width|height)\s*[<>]=?/.test(prelude)) {
          fuera.push(`${ruta}: sintaxis de rango en ${prelude.trim()}`);
        }
      }
    }
    expect(fuera).toEqual([]);
  });

  it('no usa ningún alto fuera de la escala', () => {
    const fuera: string[] = [];
    for (const { ruta, texto } of CSS) {
      for (const [, valor] of texto.matchAll(/@media[^{]*?\(\s*max-height:\s*(\d+)px\s*\)/g)) {
        if (!ALTOS_VALIDOS.includes(Number(valor))) fuera.push(`${ruta}: ${valor}px`);
      }
      for (const [, valor] of texto.matchAll(/@media[^{]*?\(\s*min-height:\s*(\d+)px\s*\)/g)) {
        fuera.push(`${ruta}: min-height ${valor}px (la escala es desktop-first)`);
      }
    }
    expect(fuera).toEqual([]);
  });
});

/**
 * Trinquete: las grillas que estaban sin piso cuando se escribió el test.
 * El grupo C (#359) las arregló todas, así que quedó vacío. Nunca se agregan
 * entradas — si este array crece, el arreglo va al CSS.
 */
const GRILLAS_PENDIENTES: string[] = [];

describe('grillas', () => {
  /**
   * Un track `1fr` es `minmax(auto, 1fr)`: no baja de su min-content, se queda
   * con más de lo que le toca y la fila desborda en vez de elidir. Es la causa
   * de tres bugs medidos (#357, #359), así que va como invariante.
   */
  it('ningún track flexible sin piso en 0', () => {
    const fuera: string[] = [];
    for (const { ruta, texto } of CSS) {
      for (const [linea] of texto.matchAll(/grid-template(?:-columns|-rows)?:[^;}]+/g)) {
        if (!linea.includes('fr')) continue;
        // `repeat(auto-fit, minmax(Npx, 1fr))` ya trae su propio piso.
        if (/minmax\(\s*0(px)?\s*,/.test(linea) || /repeat\(\s*auto-(fit|fill)\s*,\s*minmax\(/.test(linea)) {
          continue;
        }
        const hallazgo = `${ruta}: ${linea.replace(/\s+/g, ' ')}`;
        if (!GRILLAS_PENDIENTES.includes(hallazgo)) fuera.push(hallazgo);
      }
    }
    expect(fuera).toEqual([]);
  });

  it('el trinquete no tiene entradas de más', () => {
    const encontradas = new Set<string>();
    for (const { ruta, texto } of CSS) {
      for (const [linea] of texto.matchAll(/grid-template(?:-columns|-rows)?:[^;}]+/g)) {
        encontradas.add(`${ruta}: ${linea.replace(/\s+/g, ' ')}`);
      }
    }
    // Una entrada que ya no matchea es una grilla arreglada: sacala de la lista.
    expect(GRILLAS_PENDIENTES.filter((e) => !encontradas.has(e))).toEqual([]);
  });
});
