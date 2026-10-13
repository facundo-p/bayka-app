import { formatearFechaCorta } from '../../lib/fechas';
import { logoNavegador } from './recursosNavegador';
import { encabezadoDePlantacion, type EmisionPdf, type PlantacionDelEncabezado } from './textos';

/** Encabezado con el logo del navegador y la fecha de emisión, la del momento en que se arma. */
export function emisionDePlantacion(
  plantacion: PlantacionDelEncabezado,
  organizacion: string | null,
  ahora = new Date(),
): EmisionPdf {
  return {
    encabezado: encabezadoDePlantacion(plantacion, organizacion, logoNavegador()),
    emitido: formatearFechaCorta(ahora.toISOString()),
  };
}
