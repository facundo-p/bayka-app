/*
 * Punto de entrada del reporte de árboles: el service lo carga con `import()`.
 * react-pdf no entra acá: el documento se arma en un worker.
 */
import { archivosFuentesNavegador } from '../plantilla/recursosNavegador';
import type { DatosDocumentoReporte } from './DocumentoReporte';
import { renderizarEnWorker } from './renderizarEnWorker';

export { cargarFotos } from '../fotos';
export { emisionDePlantacion } from '../plantilla/emision';
export { datosArbolReporte, datosTarjeta } from './datosReporte';

/** Abortada `senal`, el armado se corta en el acto. */
export function renderizarReporte(
  documento: DatosDocumentoReporte,
  senal?: AbortSignal,
): Promise<Blob> {
  return renderizarEnWorker({ documento, fuentes: archivosFuentesNavegador() }, { senal });
}
