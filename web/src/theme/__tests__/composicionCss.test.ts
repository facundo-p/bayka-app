import { dirname, resolve } from 'node:path';
import postcss, { type Rule } from 'postcss';
import { archivosCss, type ArchivoCss } from '../../test/archivosCss';

/**
 * Guardia de `composes` entre módulos (#789).
 *
 * Cada módulo que compone una clase de otro archivo vuelve a emitir la regla
 * compuesta, y con la misma especificidad gana la última copia que se inyectó.
 * Si la clase que compone redeclara una propiedad de la compuesta, el valor
 * final depende de qué pantallas se cargaron antes: así la flecha de los
 * `<select>` quedó encima del texto. La variante tiene que pedir el cambio con
 * una propiedad custom que la compuesta lea.
 */
const CSS = archivosCss();

const LADOS = ['top', 'right', 'bottom', 'left'];
const PARTES_BORDE = ['width', 'style', 'color'];

/** Shorthands con lados: `padding-block` pisa top y bottom. */
const EJES: Record<string, string[]> = {
  block: ['top', 'bottom'],
  inline: ['left', 'right'],
};

const SHORTHANDS: Record<string, string[]> = {
  background: ['color', 'image', 'repeat', 'position', 'size', 'attachment', 'origin', 'clip'],
  font: ['family', 'size', 'weight', 'style', 'variant', 'stretch', 'line-height'],
  outline: ['color', 'style', 'width'],
  flex: ['grow', 'shrink', 'basis'],
};

/** Las propiedades longhand que una declaración fija. */
function longhands(propiedad: string): string[] {
  const [base, resto] = propiedad.split(/-(.*)/);
  if (['padding', 'margin'].includes(base)) {
    const lados = resto ? (EJES[resto] ?? [resto]) : LADOS;
    return lados.map((lado) => `${base}-${lado}`);
  }
  if (base === 'border' && !propiedad.endsWith('radius')) return longhandsBorde(resto);
  if (base in SHORTHANDS && !resto) return SHORTHANDS[base].map((parte) => `${base}-${parte}`);
  if (propiedad === 'gap') return ['row-gap', 'column-gap'];
  return [propiedad];
}

/** `border`, `border-top`, `border-color` y `border-top-color`, a lado y parte. */
function longhandsBorde(resto: string | undefined): string[] {
  const [primero, segundo] = (resto ?? '').split('-');
  const lados = LADOS.includes(primero) ? [primero] : LADOS;
  const parte = LADOS.includes(primero) ? segundo : primero;
  const partes = parte ? [parte] : PARTES_BORDE;
  return lados.flatMap((lado) => partes.map((p) => `border-${lado}-${p}`));
}

/** Clase de una regla de un solo selector simple, `.select`; null si es otra cosa. */
function claseSimple(regla: Rule): string | null {
  return /^\.([\w-]+)$/.exec(regla.selector)?.[1] ?? null;
}

/** Reglas de primer nivel por clase: `composes` solo vale ahí. */
function reglasPorClase(texto: string): Map<string, Rule> {
  const reglas = new Map<string, Rule>();
  postcss.parse(texto).each((nodo) => {
    const clase = nodo.type === 'rule' ? claseSimple(nodo) : null;
    if (clase) reglas.set(clase, nodo as Rule);
  });
  return reglas;
}

function propiedades(regla: Rule): string[] {
  return regla.nodes.flatMap((nodo) =>
    nodo.type === 'decl' && nodo.prop !== 'composes' ? [nodo.prop] : [],
  );
}

interface Composicion {
  regla: Rule;
  clases: string[];
  /** Absoluta; las composiciones del mismo archivo o de `global` no entran. */
  desde: string;
}

/** Los `composes: a b from './x.css'` de un archivo. */
function composicionesEntreArchivos(archivo: ArchivoCss): Composicion[] {
  return [...reglasPorClase(archivo.texto).values()].flatMap((regla) =>
    regla.nodes.flatMap((nodo) => {
      if (nodo.type !== 'decl' || nodo.prop !== 'composes') return [];
      const partes = /^(.+?)\s+from\s+['"](.+)['"]$/.exec(nodo.value);
      if (!partes) return [];
      const desde = resolve(dirname(archivo.absoluta), partes[2]);
      return [{ regla, clases: partes[1].split(/\s+/), desde }];
    }),
  );
}

type Indice = Map<string, ArchivoCss>;

/** Propiedades que la regla redeclara de una clase compuesta, como hallazgos. */
function pisadas({ regla, clases, desde }: Composicion, indice: Indice): string[] {
  const reglasDestino = reglasPorClase(indice.get(desde)?.texto ?? '');
  return clases.flatMap((clase) => {
    const compuesta = reglasDestino.get(clase);
    if (!compuesta) return [];
    const fijadas = new Set(propiedades(compuesta).flatMap(longhands));
    return propiedades(regla)
      .filter((propiedad) => longhands(propiedad).some((longhand) => fijadas.has(longhand)))
      .map((propiedad) => `${regla.selector} redeclara ${propiedad} de .${clase}`);
  });
}

function hallazgos(archivos: ArchivoCss[]): string[] {
  const indice: Indice = new Map(archivos.map((archivo) => [archivo.absoluta, archivo]));
  return archivos.flatMap((archivo) =>
    composicionesEntreArchivos(archivo).flatMap((composicion) =>
      pisadas(composicion, indice).map((hallazgo) => `${archivo.ruta}: ${hallazgo}`),
    ),
  );
}

test('ninguna clase que compone de otro módulo redeclara una propiedad de la compuesta', () => {
  expect(CSS.some((archivo) => archivo.texto.includes('composes:'))).toBe(true);
  expect(hallazgos(CSS)).toEqual([]);
});

describe('el chequeo dispara', () => {
  const archivo = (ruta: string, texto: string): ArchivoCss => ({
    absoluta: resolve('/src', ruta),
    ruta,
    texto,
  });
  const base = archivo('base.css', '.control { padding: 0 16px; background-color: white; }');

  test.each([
    ['padding-right contra el shorthand', 'padding-right: 32px;', ['padding-right']],
    ['background contra background-color', 'background: none;', ['background']],
  ])('%s', (_, declaracion, pisadasEsperadas) => {
    const select = archivo(
      'select.css',
      `.select { composes: control from './base.css'; ${declaracion} }`,
    );
    expect(hallazgos([select, base])).toEqual(
      pisadasEsperadas.map((p) => `select.css: .select redeclara ${p} de .control`),
    );
  });

  test('una propiedad custom o un longhand que la compuesta no fija no son pisadas', () => {
    const select = archivo(
      'select.css',
      `.select { composes: control from './base.css'; --control-padding-derecho: 32px; background-image: none; }`,
    );
    expect(hallazgos([select, base])).toEqual([]);
  });
});
