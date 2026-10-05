/**
 * Peso de las fotos en el catálogo, antes de descargar (#685). Sin fotos o con
 * un server que no trae el dato no se muestra nada: un "0 KB" se leería como
 * "no tiene fotos" aunque no lo sepamos.
 */
import type { ServerPlantation } from '../queries/catalogQueries';
import { formatearPeso } from './pesoDeArchivos';

type ConPesoDeFotos = Pick<ServerPlantation, 'id' | 'photo_count' | 'photo_bytes'>;

const ROTULO_INCLUIR_FOTOS = 'Incluir fotos';

const bytesConocidos = (p: ConPesoDeFotos): number =>
  p.photo_count ? p.photo_bytes ?? 0 : 0;

/** "41 MB" para la card, o null si no hay nada que mostrar. */
export function pesoDeFotos(plantacion: ConPesoDeFotos): string | null {
  const bytes = bytesConocidos(plantacion);
  return bytes > 0 ? formatearPeso(bytes) : null;
}

/** "Incluir fotos · 128 MB" con el total de lo seleccionado; sin sufijo si no suma nada. */
export function rotuloIncluirFotos(catalogo: ConPesoDeFotos[], seleccionadas: Set<string>): string {
  const total = catalogo
    .filter((p) => seleccionadas.has(p.id))
    .reduce((suma, p) => suma + bytesConocidos(p), 0);
  return total > 0 ? `${ROTULO_INCLUIR_FOTOS} · ${formatearPeso(total)}` : ROTULO_INCLUIR_FOTOS;
}
