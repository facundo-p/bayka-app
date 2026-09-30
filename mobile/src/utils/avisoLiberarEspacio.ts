/**
 * Textos de "Liberar espacio" (#565). Borra archivos del celular: el aviso dice
 * qué se borra, que no se quita de Bayka y qué pasa en la próxima sincronización.
 */
import { plural } from './plural';
import { formatearPeso } from './pesoDeArchivos';

const fotos = (n: number) => plural(n, 'foto');

/** "3 fotos sin subir se conservan." Vacío si no hay. */
export function textoSinSubir(sinSubir: number): string {
  if (sinSubir === 0) return '';
  return sinSubir === 1 ? '1 foto sin subir se conserva.' : `${sinSubir} fotos sin subir se conservan.`;
}

/** Rótulo del botón de Ajustes: "Liberar espacio · 212 fotos, 74 MB". */
export function rotuloLiberarEspacio(n: number, bytes: number): string {
  return n === 0 ? 'Liberar espacio' : `Liberar espacio · ${fotos(n)}, ${formatearPeso(bytes)}`;
}

function textoProximaSync(descargarFotos: boolean): string {
  return descargarFotos
    ? 'Con "Descargar fotos de otros celulares" prendido, la próxima sincronización las vuelve a descargar.'
    : 'Quedan en la nube y podés descargarlas de a una desde cada árbol.';
}

function textoSinConfirmar(sinConfirmar: number): string {
  if (sinConfirmar === 0) return '';
  return sinConfirmar === 1
    ? '1 foto que la nube no confirmó se conserva.'
    : `${sinConfirmar} fotos que la nube no confirmó se conservan.`;
}

export function mensajeConfirmarLiberar(params: {
  fotos: number;
  bytes: number;
  sinSubir: number;
  sinConfirmar: number;
  descargarFotos: boolean;
}): string {
  const { bytes, sinSubir, sinConfirmar, descargarFotos } = params;
  return [
    `Se borran de este celular ${fotos(params.fotos)} (${formatearPeso(bytes)}) que ya están en la nube. No se quitan de Bayka ni de los demás celulares.`,
    textoProximaSync(descargarFotos),
    [textoSinSubir(sinSubir), textoSinConfirmar(sinConfirmar)].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n\n');
}

export function mensajeNadaParaLiberar(sinConfirmar: number): string {
  return sinConfirmar > 0
    ? `La nube no confirmó ${fotos(sinConfirmar)} de este celular, así que se conservan.`
    : 'No hay fotos descargadas en este celular.';
}

export const MENSAJE_SIN_CONEXION =
  'No se pudo confirmar con la nube qué fotos tiene. Revisá la conexión y probá de nuevo. No se borró nada.';

export function mensajeLiberado(n: number, bytes: number): string {
  return `Se liberaron ${formatearPeso(bytes)} en este celular (${fotos(n)}).`;
}
