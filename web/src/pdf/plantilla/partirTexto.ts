/*
 * Parte un texto en los renglones de su caja, por palabra y a ancho natural
 * (#876). Cada renglón va en su propio `Text`: textkit no lo vuelve a partir ni
 * lo justifica, así que ningún renglón sale con los espacios apretados.
 */
import { conMemoria } from './memoria';
import { entraEn, grafemas, mayorQueEntra, saleEntero, type Medidor } from './medirTexto';

/** Un texto ya partido, un renglón por elemento. */
export type TextoEnRenglones = readonly string[];

const ESPACIOS = /\s+/;
const ESPACIO = ' ';

type Corte = { renglon: string; resto: string[] };

const juntar = (partes: readonly string[], cantidad: number, union: string) =>
  partes.slice(0, cantidad).join(union);

/** Cuántas de las primeras `partes`, juntas con `union`, entran en `caja` pt. */
function cuantasEntran(partes: readonly string[], union: string, medir: Medidor, caja: number) {
  const entran = (n: number) => entraEn(medir(juntar(partes, n, union)), caja);
  return Math.max(0, mayorQueEntra(partes.length, entran));
}

/** Lo que entra de la primera palabra, por grafema; con `minimo`, el renglón siempre avanza. */
function partirPalabra(palabras: string[], medir: Medidor, caja: number, minimo: number): Corte {
  const [palabra, ...siguientes] = palabras;
  const partes = grafemas(palabra);
  const cantidad = Math.max(minimo, cuantasEntran(partes, '', medir, caja));
  const resto = partes.slice(cantidad).join('');
  return {
    renglon: juntar(partes, cantidad, ''),
    resto: resto ? [resto, ...siguientes] : siguientes,
  };
}

/**
 * El renglón que arman las primeras palabras en `caja` pt. Si ni la primera
 * entra en el primer renglón, más angosto, pasa entera al siguiente si ahí
 * entra; si no entra en ninguno, se parte.
 */
function siguienteRenglon(palabras: string[], medir: Medidor, caja: number, ancho: number): Corte {
  const enteras = cuantasEntran(palabras, ESPACIO, medir, caja);
  if (enteras > 0)
    return { renglon: juntar(palabras, enteras, ESPACIO), resto: palabras.slice(enteras) };
  const angosto = caja < ancho;
  if (angosto && entraEn(medir(palabras[0]), ancho)) return { renglon: '', resto: palabras };
  return partirPalabra(palabras, medir, caja, angosto ? 0 : 1);
}

/**
 * Los renglones de `texto` en una caja de `ancho` pt. El primero mide
 * `anchoPrimero` cuando comparte el renglón con lo que va delante, como el
 * código de una parcela. Lo que entra sale igual; partido, los espacios
 * seguidos quedan en uno.
 */
export function partirTexto(
  texto: string,
  medir: Medidor,
  ancho: number,
  anchoPrimero = ancho,
): string[] {
  if (saleEntero(texto, medir, anchoPrimero)) return [texto];
  const renglones: string[] = [];
  let palabras = texto.trim().split(ESPACIOS);
  while (palabras.length > 0) {
    const caja = renglones.length === 0 ? anchoPrimero : ancho;
    const { renglon, resto } = siguienteRenglon(palabras, medir, caja, ancho);
    renglones.push(renglon);
    palabras = resto;
  }
  return renglones;
}

export type Partidor = (texto: string, ancho: number, anchoPrimero?: number) => TextoEnRenglones;

/**
 * `partirTexto` con memoria: la medida de cada texto entero, y los renglones de
 * cada texto en cada caja. Las cajas son pocas: una por columna y por largo de código.
 */
export function partidorConMemoria(medir: Medidor): Partidor {
  const medirEntero = conMemoria(medir);
  const enCaja = conMemoria((ancho: number) =>
    conMemoria((primero: number) =>
      conMemoria((texto: string) => partirTexto(texto, medir, ancho, primero)),
    ),
  );
  return (texto, ancho, anchoPrimero = ancho) =>
    saleEntero(texto, medirEntero, anchoPrimero) ? [texto] : enCaja(ancho)(anchoPrimero)(texto);
}
