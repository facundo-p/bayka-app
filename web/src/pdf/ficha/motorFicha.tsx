/*
 * Punto de entrada de la ficha PDF: el service lo carga con `import()`, así
 * react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import type { FotoPdf } from '../estadoFoto';
import { cargarFotos } from '../fotos';
import { renderizarSaneado } from '../plantilla/fuentes';
import { archivosFuentesNavegador } from '../plantilla/recursosNavegador';
import { DocumentoFicha, type DocumentoFichaProps } from './DocumentoFicha';
import { MEDIDA_FOTO_FICHA } from './rasterFicha';

export { emisionDePlantacion } from '../plantilla/emision';
export { datosFicha } from './datosFicha';
export { minimapaDeArbol } from './minimapa';

/** La foto al tamaño de la ficha. */
export async function cargarFoto(fotoUrl: string | null): Promise<FotoPdf> {
  const [foto] = await cargarFotos([fotoUrl], { medida: MEDIDA_FOTO_FICHA });
  return foto;
}

export async function renderizarFicha(props: DocumentoFichaProps): Promise<Blob> {
  return renderizarSaneado(archivosFuentesNavegador(), props, (saneadas) =>
    pdf(<DocumentoFicha {...saneadas} />).toBlob(),
  );
}
