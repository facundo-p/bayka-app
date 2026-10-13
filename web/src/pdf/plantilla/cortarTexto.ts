/*
 * Corta un texto al ancho de su caja y le agrega «…». textkit, el motor de
 * texto de react-pdf, corta después de partir el renglón: el «…» lo deja más
 * ancho que la caja y textkit achica los espacios hasta pegar las palabras
 * (#876). Cortado antes, el renglón entra y textkit no lo toca.
 */
import { conMemoria } from './memoria';
import { grafemas, mayorQueEntra, entraEn, saleEntero, type Medidor } from './medirTexto';

const ELIPSIS = '…';

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

type Cortador = (texto: string, ancho: number) => string;

/**
 * `cortarTexto` con memoria: la medida de cada texto entero, y el corte de cada
 * texto en cada ancho. Los anchos son pocos: uno por caja y por largo de código.
 */
export function cortadorConMemoria(medir: Medidor): Cortador {
  const medirEntero = conMemoria(medir);
  const enAncho = conMemoria((ancho: number) =>
    conMemoria((texto: string) => cortarLoQueNoEntra(texto, medir, ancho)),
  );
  return (texto, ancho) => (saleEntero(texto, medirEntero, ancho) ? texto : enAncho(ancho)(texto));
}
