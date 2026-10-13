/*
 * Punto de entrada de las fichas PDF: el service lo carga con `import()`, así
 * react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import type { FotoPdf } from '../estadoFoto';
import { cargarFotos as cargarFotosPdf } from '../fotos';
import { renderizarEnSerie } from '../plantilla/fuentes';
import { archivosFuentesNavegador } from '../plantilla/recursosNavegador';
import { DocumentoFichas, type DocumentoFichasProps } from './DocumentoFichas';
import { MEDIDA_FOTO_FICHA } from './rasterFicha';

export { emisionDePlantacion } from '../plantilla/emision';
export { datosFicha } from './datosFicha';
export { minimapaDeArbol } from './minimapa';

/** Las fotos al tamaño de la ficha. */
export function cargarFotos(fotoUrls: ReadonlyArray<string | null>): Promise<FotoPdf[]> {
  return cargarFotosPdf(fotoUrls, { medida: MEDIDA_FOTO_FICHA });
}

export async function renderizarFichas(props: DocumentoFichasProps): Promise<Blob> {
  return renderizarEnSerie(archivosFuentesNavegador(), () =>
    pdf(<DocumentoFichas {...props} />).toBlob(),
  );
}
