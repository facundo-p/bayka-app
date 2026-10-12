/*
 * Punto de entrada del reporte de árboles: el service lo carga con `import()`.
 * react-pdf no entra acá: el documento se arma en un worker.
 */
import { archivosFuentesNavegador, logoNavegador } from '../plantilla/recursosNavegador';
import type { DocumentoReporteProps } from './DocumentoReporte';
import { renderizarEnWorker } from './renderizarEnWorker';

export { cargarFotos } from '../fotos';
export { encabezadoDePlantacion } from '../plantilla/textos';
export { datosArbolReporte, datosTarjeta } from './datosReporte';
export { logoNavegador };

export function renderizarReporte(documento: DocumentoReporteProps): Promise<Blob> {
  return renderizarEnWorker({ documento, fuentes: archivosFuentesNavegador() });
}
