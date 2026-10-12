/*
 * Punto de entrada del reporte de árboles: el service lo carga con `import()`,
 * así react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import { renderizarEnSerie } from '../plantilla/fuentes';
import { archivosFuentesNavegador, logoNavegador } from '../plantilla/recursosNavegador';
import { DocumentoReporte, type DocumentoReporteProps } from './DocumentoReporte';

export { cargarFotos } from '../fotos';
export { encabezadoDePlantacion } from '../plantilla/textos';
export { datosArbolReporte, datosTarjeta } from './datosReporte';
export { logoNavegador };

export async function renderizarReporte(props: DocumentoReporteProps): Promise<Blob> {
  return renderizarEnSerie(archivosFuentesNavegador(), () =>
    pdf(<DocumentoReporte {...props} />).toBlob(),
  );
}
