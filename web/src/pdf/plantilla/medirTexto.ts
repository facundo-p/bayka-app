/*
 * Mide un renglón como lo arma textkit, el motor de texto de react-pdf, para
 * cortarlo o partirlo antes del render (#876).
 */

/**
 * El ancho de la caja sale de yoga en float32, y textkit suma los avances en
 * otro orden: un texto que llega casi al borde puede no entrarle, y lo parte.
 */
const HOLGURA_REDONDEO = 1e-3;

/**
 * Signos, cifras y espacios antes de la primera letra: textkit los arma en un
 * tramo aparte, sin kerning con lo que sigue.
 */
const INICIO_SIN_ESCRITURA = /^[\p{Script=Common}\p{Script=Inherited}]*/u;

/** Ancho en pt de un texto, en la fuente, el tamaño y el espaciado de su renglón. */
export type Medidor = (texto: string) => number;

/** Lo que se usa de una fuente de fontkit, la que carga react-pdf, o de una estándar de pdfkit. */
export type FuenteMedible = {
  unitsPerEm: number;
  layout(texto: string): { positions: ReadonlyArray<{ xAdvance: number }> };
  hasGlyphForCodePoint(codePoint: number): boolean;
};

export type EstiloMedido = {
  /** En pt. */
  tamano: number;
  /** El `letterSpacing` del estilo, en pt. */
  espaciado?: number;
};

type Tramo = { fuente: FuenteMedible; texto: string };

/**
 * Los tramos seguidos que dibuja una misma fuente. Como textkit: la del estilo
 * si tiene el glifo y, si no, la de respaldo (Š, ž, ƒ no están en Poppins).
 */
function tramosPorFuente(texto: string, fuente: FuenteMedible, respaldo: FuenteMedible): Tramo[] {
  if (respaldo === fuente) return [{ fuente, texto }];
  const tramos: Tramo[] = [];
  for (const caracter of texto) {
    const dibuja = fuente.hasGlyphForCodePoint(caracter.codePointAt(0)!) ? fuente : respaldo;
    const ultimo = tramos.at(-1);
    if (ultimo?.fuente === dibuja) ultimo.texto += caracter;
    else tramos.push({ fuente: dibuja, texto: caracter });
  }
  return tramos;
}

/**
 * Mide un renglón entero como textkit: el avance de cada glifo, con el kerning
 * y las ligaduras de fontkit, escalado al tamaño. textkit suma el espaciado
 * también tras el último glifo. Lo que la fuente no tiene se mide con
 * `respaldo`, la que lo dibuja.
 */
export function medidorDeFuente(
  fuente: FuenteMedible,
  { tamano, espaciado = 0 }: EstiloMedido,
  respaldo: FuenteMedible = fuente,
): Medidor {
  const medirTramo = ({ fuente: dibuja, texto }: Tramo) => {
    const escala = tamano / dibuja.unitsPerEm;
    const { positions } = dibuja.layout(texto);
    return positions.reduce((ancho, { xAdvance }) => ancho + xAdvance * escala + espaciado, 0);
  };
  const medirParte = (parte: string) =>
    tramosPorFuente(parte, fuente, respaldo).reduce((ancho, tramo) => ancho + medirTramo(tramo), 0);
  return (texto) => {
    const inicio = INICIO_SIN_ESCRITURA.exec(texto)?.[0] ?? '';
    return medirParte(inicio) + medirParte(texto.slice(inicio.length));
  };
}

let segmentador: Intl.Segmenter | undefined;

/**
 * Por grafema: un corte no separa un emoji de su par sustituto ni una letra de
 * su tilde. Sin `Intl.Segmenter`, por punto de código.
 */
export function grafemas(texto: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return Array.from(texto);
  segmentador ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmentador.segment(texto), ({ segment }) => segment);
}

/** El mayor `n` entre 0 y `maximo` que cumple `entra`, o -1 si ninguno; `entra` es monótona. */
export function mayorQueEntra(maximo: number, entra: (n: number) => boolean): number {
  let entraHasta = -1;
  let noEntraDesde = maximo + 1;
  while (noEntraDesde - entraHasta > 1) {
    const medio = Math.floor((entraHasta + noEntraDesde) / 2);
    if (entra(medio)) entraHasta = medio;
    else noEntraDesde = medio;
  }
  return entraHasta;
}

export const entraEn = (medida: number, ancho: number) => medida <= ancho - HOLGURA_REDONDEO;

/** Lo vacío y lo que entra no se cortan ni se parten. */
export const saleEntero = (texto: string, medir: Medidor, ancho: number) =>
  !texto || entraEn(medir(texto), ancho);

/**
 * Calcula una sola vez por clave: los nombres de parcela, grupo y especie se
 * repiten en miles de filas, y las cajas son pocas.
 */
export function conMemoria<K, T>(calcular: (clave: K) => T): (clave: K) => T {
  const hechos = new Map<K, T>();
  return (clave) => {
    let hecho = hechos.get(clave);
    if (hecho === undefined) {
      hecho = calcular(clave);
      hechos.set(clave, hecho);
    }
    return hecho;
  };
}
