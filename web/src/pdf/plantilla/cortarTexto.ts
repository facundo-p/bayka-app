/*
 * Corta un texto al ancho de su caja y le agrega «…». textkit, el motor de
 * texto de react-pdf, corta después de partir el renglón: el «…» lo deja más
 * ancho que la caja y textkit achica los espacios hasta pegar las palabras
 * (#876). Cortado antes, el renglón entra y textkit no lo toca.
 */

const ELIPSIS = '…';

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

/** Lo que se usa de una fuente de fontkit, la que carga react-pdf. */
export type FuenteMedible = {
  unitsPerEm: number;
  layout(texto: string): { positions: ReadonlyArray<{ xAdvance: number }> };
};

export type EstiloMedido = {
  /** En pt. */
  tamano: number;
  /** El `letterSpacing` del estilo, en pt. */
  espaciado?: number;
};

/**
 * Mide un renglón entero como textkit: el avance de cada glifo, con el kerning
 * y las ligaduras de fontkit, escalado al tamaño. textkit suma el espaciado
 * también tras el último glifo.
 *
 * Un carácter que la fuente no tiene (Š, ž, ƒ en Poppins) textkit lo dibuja
 * con Helvetica, y acá se mide con el glifo vacío: el corte puede errar y lo
 * vuelve a cortar textkit, como antes de #876.
 */
export function medidorDeFuente(
  fuente: FuenteMedible,
  { tamano, espaciado = 0 }: EstiloMedido,
): Medidor {
  const escala = tamano / fuente.unitsPerEm;
  const medirTramo = (tramo: string) =>
    fuente
      .layout(tramo)
      .positions.reduce((ancho, { xAdvance }) => ancho + xAdvance * escala + espaciado, 0);
  return (texto) => {
    const inicio = INICIO_SIN_ESCRITURA.exec(texto)?.[0] ?? '';
    return medirTramo(inicio) + medirTramo(texto.slice(inicio.length));
  };
}

let segmentador: Intl.Segmenter | undefined;

/**
 * Por grafema: un corte no separa un emoji de su par sustituto ni una letra de
 * su tilde. Sin `Intl.Segmenter`, por punto de código.
 */
function grafemas(texto: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return Array.from(texto);
  segmentador ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(segmentador.segment(texto), ({ segment }) => segment);
}

/** El mayor `n` entre 0 y `maximo` que cumple `entra`, o -1 si ninguno; `entra` es monótona. */
function mayorQueEntra(maximo: number, entra: (n: number) => boolean): number {
  let entraHasta = -1;
  let noEntraDesde = maximo + 1;
  while (noEntraDesde - entraHasta > 1) {
    const medio = Math.floor((entraHasta + noEntraDesde) / 2);
    if (entra(medio)) entraHasta = medio;
    else noEntraDesde = medio;
  }
  return entraHasta;
}

const entraEn = (medida: number, ancho: number) => medida <= ancho - HOLGURA_REDONDEO;

/** Lo vacío y lo que entra no se cortan. */
const saleEntero = (texto: string, medir: Medidor, ancho: number) =>
  !texto || entraEn(medir(texto), ancho);

/**
 * El corte más largo que entra en `ancho` pt con «…», sin el espacio de antes.
 * Si ni el «…» solo entra, queda el «…»: lo cortado siempre se nota.
 */
function cortarLoQueNoEntra(texto: string, medir: Medidor, ancho: number): string {
  const partes = grafemas(texto);
  const corte = (cantidad: number) => `${partes.slice(0, cantidad).join('').trimEnd()}${ELIPSIS}`;
  const cantidad = mayorQueEntra(partes.length - 1, (n) => entraEn(medir(corte(n)), ancho));
  return cantidad < 0 ? ELIPSIS : corte(cantidad);
}

/** El texto entero si entra en `ancho` pt; si no, cortado con «…». */
export function cortarTexto(texto: string, medir: Medidor, ancho: number): string {
  return saleEntero(texto, medir, ancho) ? texto : cortarLoQueNoEntra(texto, medir, ancho);
}

/**
 * Calcula una sola vez por texto: los nombres de parcela, grupo y especie se
 * repiten en miles de filas.
 */
export function conMemoria<T>(calcular: (texto: string) => T): (texto: string) => T {
  const hechos = new Map<string, T>();
  return (texto) => {
    let hecho = hechos.get(texto);
    if (hecho === undefined) {
      hecho = calcular(texto);
      hechos.set(texto, hecho);
    }
    return hecho;
  };
}

export type Cortador = (texto: string, ancho: number) => string;

/**
 * `cortarTexto` con memoria: la medida de cada texto entero, y el corte de cada
 * texto en cada ancho. Los anchos son pocos: uno por caja y por largo de código.
 */
export function cortadorConMemoria(medir: Medidor): Cortador {
  const medirEntero = conMemoria(medir);
  const porAncho = new Map<number, (texto: string) => string>();
  return (texto, ancho) => {
    if (saleEntero(texto, medirEntero, ancho)) return texto;
    let cortar = porAncho.get(ancho);
    if (!cortar) {
      cortar = conMemoria((largo) => cortarLoQueNoEntra(largo, medir, ancho));
      porAncho.set(ancho, cortar);
    }
    return cortar(texto);
  };
}
