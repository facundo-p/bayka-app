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

const PROP_COMPOSES = 'composes';

/** Reglas de primer nivel por clase: `composes` solo vale ahí. Una clase puede repetirse. */
function reglasPorClase(texto: string): Map<string, Rule[]> {
  const reglas = new Map<string, Rule[]>();
  postcss.parse(texto).each((nodo) => {
    const clase = nodo.type === 'rule' ? claseSimple(nodo) : null;
    if (clase) reglas.set(clase, [...(reglas.get(clase) ?? []), nodo as Rule]);
  });
  return reglas;
}

function propiedades(regla: Rule): string[] {
  return regla.nodes.flatMap((nodo) =>
    nodo.type === 'decl' && nodo.prop !== PROP_COMPOSES ? [nodo.prop] : [],
  );
}

interface Composicion {
  clases: string[];
  /** Ruta absoluta del archivo de las clases; null si son `global`. */
  desde: string | null;
}

/** Sin `from`, las clases son del mismo archivo. */
function archivoDeOrigen(origen: string | undefined, archivo: string): string | null {
  if (!origen) return archivo;
  if (origen === 'global') return null;
  return resolve(dirname(archivo), origen.replace(/^['"]|['"]$/g, ''));
}

function composicionesDe(regla: Rule, archivo: string): Composicion[] {
  return regla.nodes.flatMap((nodo) => {
    if (nodo.type !== 'decl' || nodo.prop !== PROP_COMPOSES) return [];
    const [, clases, origen] = /^(.+?)(?:\s+from\s+(\S+))?$/.exec(nodo.value) ?? [];
    return clases ? [{ clases: clases.split(/\s+/), desde: archivoDeOrigen(origen, archivo) }] : [];
  });
}

type Indice = Map<string, ArchivoCss>;

/** Longhands que fija una clase, sumando las que compone a cualquier profundidad. */
function fijadasPor(clase: string, archivo: string | null, indice: Indice): string[] {
  if (!archivo) return [];
  const reglas = reglasPorClase(indice.get(archivo)?.texto ?? '').get(clase) ?? [];
  return reglas.flatMap((regla) => [
    ...propiedades(regla).flatMap(longhands),
    ...composicionesDe(regla, archivo).flatMap(({ clases, desde }) =>
      clases.flatMap((compuesta) => fijadasPor(compuesta, desde, indice)),
    ),
  ]);
}

/** Propiedades que la regla redeclara de una clase compuesta, como hallazgos. */
function pisadas(regla: Rule, { clases, desde }: Composicion, indice: Indice): string[] {
  return clases.flatMap((clase) => {
    const fijadas = new Set(fijadasPor(clase, desde, indice));
    return propiedades(regla)
      .filter((propiedad) => longhands(propiedad).some((longhand) => fijadas.has(longhand)))
      .map((propiedad) => `${regla.selector} redeclara ${propiedad} de .${clase}`);
  });
}

/** Solo entre archivos: dentro de uno, el orden de las reglas es fijo. */
function hallazgosDe(archivo: ArchivoCss, indice: Indice): string[] {
  return [...reglasPorClase(archivo.texto).values()].flat().flatMap((regla) =>
    composicionesDe(regla, archivo.absoluta)
      .filter(({ desde }) => desde !== null && desde !== archivo.absoluta)
      .flatMap((composicion) => pisadas(regla, composicion, indice))
      .map((hallazgo) => `${archivo.ruta}: ${hallazgo}`),
  );
}

function hallazgos(archivos: ArchivoCss[]): string[] {
  const indice: Indice = new Map(archivos.map((archivo) => [archivo.absoluta, archivo]));
  return archivos.flatMap((archivo) => hallazgosDe(archivo, indice));
}

test('ninguna clase que compone de otro módulo redeclara una propiedad de la compuesta', () => {
  expect(CSS.some((archivo) => archivo.texto.includes(`${PROP_COMPOSES}:`))).toBe(true);
  expect(hallazgos(CSS)).toEqual([]);
});

describe('el chequeo dispara', () => {
  const archivo = (ruta: string, texto: string): ArchivoCss => ({
    absoluta: resolve('/src', ruta),
    ruta,
    texto,
  });
  const base = archivo('base.css', '.control { padding: 0 16px; background-color: white; }');
  const select = (declaracion: string) =>
    archivo('select.css', `.select { composes: control from './base.css'; ${declaracion} }`);

  test.each([
    ['padding-right contra el shorthand', 'padding-right: 32px;', ['padding-right']],
    ['background contra background-color', 'background: none;', ['background']],
  ])('%s', (_, declaracion, pisadasEsperadas) => {
    expect(hallazgos([select(declaracion), base])).toEqual(
      pisadasEsperadas.map((p) => `select.css: .select redeclara ${p} de .control`),
    );
  });

  test('una propiedad custom o un longhand que la compuesta no fija no son pisadas', () => {
    const variante = select('--control-padding-derecho: 32px; background-image: none;');
    expect(hallazgos([variante, base])).toEqual([]);
  });

  test('ve lo que la compuesta hereda de otra composición', () => {
    const disparador = archivo(
      'disparador.css',
      `.disparador { composes: select from './select.css'; padding-right: 8px; }`,
    );
    expect(hallazgos([disparador, select(''), base])).toEqual([
      'disparador.css: .disparador redeclara padding-right de .select',
    ]);
  });

  test('las composiciones del mismo archivo y las de global no se revisan', () => {
    const local = archivo(
      'local.css',
      `.base { padding: 0; } .a { composes: base; padding: 1px; } .b { composes: x from global; padding: 1px; }`,
    );
    expect(hallazgos([local])).toEqual([]);
  });
});
