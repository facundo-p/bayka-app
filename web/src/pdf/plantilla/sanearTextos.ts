/*
 * Los textos de un documento, listos para textkit (#882). Para cada carácter,
 * textkit prueba la fuente del texto y después Helvetica, que @react-pdf/layout
 * agrega al final de toda pila. Si ninguna tiene el glifo, lo dibuja igual con
 * Helvetica: sale otro carácter, o nada.
 */

/**
 * Lo que va en lugar de lo que no se dibuja. «?» lo tienen todas las fuentes y
 * se ve: avisa que ahí había algo.
 */
export const REEMPLAZO_TEXTO = {
  sinGlifo: '?',
  marcaSuelta: '',
  blanco: ' ',
} as const;

/** Lo que se le pregunta a una fuente leída: fontkit y el StandardFont de @react-pdf/font responden igual. */
export type FuenteConGlifos = { hasGlyphForCodePoint(codigo: number): boolean };

/** Las fuentes que textkit prueba para un texto, en orden. */
export type PilaDeFuentes = readonly FuenteConGlifos[];

export type Dibujable = (codigo: number) => boolean;

export type SanearTexto = (texto: string) => string;

/** Rachas de controles y de blancos Unicode: saltos de línea y tabs incluidos. */
const BLANCOS = /[\s\p{Cc}]+/gu;

/**
 * Lo que no es ASCII imprimible, o un blanco repetido. El resto sale igual,
 * porque Helvetica tiene todo el ASCII imprimible: así las URL data: de fotos y
 * mapas no se recorren carácter por carácter.
 */
const NECESITA_SANEAR = /[^\x20-\x7e]| {2}/;

/** Una marca combinante sola, como la tilde de «g̃». */
const MARCA = /^\p{M}$/u;

/** Una letra y sus marcas combinantes, en NFD: «ĩ» es «i» más tilde. */
const BASE_CON_MARCAS = /^(\P{M})\p{M}+$/u;

function conMemoria<C, V>(calcular: (clave: C) => V): (clave: C) => V {
  const hechos = new Map<C, V>();
  return (clave) => {
    let hecho = hechos.get(clave);
    if (hecho === undefined) {
      hecho = calcular(clave);
      hechos.set(clave, hecho);
    }
    return hecho;
  };
}

/**
 * Del modelo no se sabe en qué letra va cada texto: un punto de código se
 * acepta si lo puede dibujar cada pila. Con Helvetica al final de todas, es
 * que lo tenga ella o que lo tengan todas las fuentes registradas.
 */
export function dibujableEnTodas(pilas: readonly PilaDeFuentes[]): Dibujable {
  return conMemoria((codigo: number) =>
    pilas.every((pila) => pila.some((fuente) => fuente.hasGlyphForCodePoint(codigo))),
  );
}

const codigoDe = (caracter: string) => caracter.codePointAt(0)!;

/**
 * Lo que va en lugar de un carácter que no se dibuja: su letra base, si se
 * dibuja («ĩ» → «i»); nada, si es una marca suelta («g̃» → «g»); si no, «?».
 * Los nombres guaraníes se leen mejor sin la tilde que con un «?».
 */
function sustituto(caracter: string, dibujable: Dibujable): string {
  if (MARCA.test(caracter)) return REEMPLAZO_TEXTO.marcaSuelta;
  const base = BASE_CON_MARCAS.exec(caracter.normalize('NFD'))?.[1];
  return base && dibujable(codigoDe(base)) ? base : REEMPLAZO_TEXTO.sinGlifo;
}

const conGlifo = (caracter: string, dibujable: Dibujable) =>
  dibujable(codigoDe(caracter)) ? caracter : sustituto(caracter, dibujable);

/** NFC primero: una «á» escrita como «a» más tilde pasa a la «á» que tienen las fuentes. */
function sanear(texto: string, dibujable: Dibujable): string {
  const compuesto = texto.normalize('NFC').replace(BLANCOS, REEMPLAZO_TEXTO.blanco);
  return Array.from(compuesto, (caracter) => conGlifo(caracter, dibujable)).join('');
}

/** Con memoria: el reporte repite los mismos nombres en miles de filas. */
export function saneadorDeTexto(dibujable: Dibujable): SanearTexto {
  const saneado = conMemoria((texto: string) => sanear(texto, dibujable));
  return (texto) => (NECESITA_SANEAR.test(texto) ? saneado(texto) : texto);
}

/** Objetos planos y arrays. Blob, ArrayBuffer, typed arrays y demás pasan tal cual. */
function esRecorrible(valor: unknown): valor is object {
  if (Array.isArray(valor)) return true;
  if (valor === null || typeof valor !== 'object') return false;
  const prototipo = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

function copiar(valor: object, recorrer: (campo: unknown) => unknown): unknown {
  if (Array.isArray(valor)) return valor.map(recorrer);
  return Object.fromEntries(
    Object.entries(valor).map(([clave, campo]) => [clave, recorrer(campo)]),
  );
}

/**
 * Una copia de `valor` con cada string saneado. Lo que estaba compartido sigue
 * compartido: un mismo objeto da una misma copia.
 */
export function sanearTextos<T>(valor: T, sanearTexto: SanearTexto): T {
  const copias = new Map<object, unknown>();
  const recorrer = (actual: unknown): unknown => {
    if (typeof actual === 'string') return sanearTexto(actual);
    if (!esRecorrible(actual)) return actual;
    if (!copias.has(actual)) copias.set(actual, copiar(actual, recorrer));
    return copias.get(actual);
  };
  return recorrer(valor) as T;
}
