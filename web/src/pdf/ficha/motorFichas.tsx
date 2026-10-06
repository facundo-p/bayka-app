/*
 * Punto de entrada de las fichas PDF: el service lo carga con `import()`, así
 * react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import { registrarFuentes } from '../plantilla/fuentes';
import { archivosFuentesNavegador, logoNavegador } from '../plantilla/recursosNavegador';
import { DocumentoFichas, type DocumentoFichasProps } from './DocumentoFichas';

export { cargarFotos } from '../fotos';
export { encabezadoDePlantacion } from '../plantilla/textos';
export { datosFicha } from './datosFicha';
export { minimapaDeArbol } from './minimapa';
export { logoNavegador };

export async function renderizarFichas(props: DocumentoFichasProps): Promise<Blob> {
  registrarFuentes(archivosFuentesNavegador());
  return pdf(<DocumentoFichas {...props} />).toBlob();
}
