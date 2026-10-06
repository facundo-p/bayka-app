/*
 * Punto de entrada de las fichas PDF: el service lo carga con `import()`, así
 * react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import type { ArbolParaFicha } from '../../queries/fichasQueries';
import type { PuntoGps } from '../../queries/mapaQueries';
import { dibujarMapa } from '../mapa/dibujarMapa';
import { registrarFuentes } from '../plantilla/fuentes';
import { archivosFuentesNavegador, logoNavegador } from '../plantilla/recursosNavegador';
import { DocumentoFichas, type DocumentoFichasProps } from './DocumentoFichas';
import { contenidoMinimapa } from './minimapa';

export { cargarFotos } from '../fotos';
export { encabezadoDePlantacion } from '../plantilla/textos';
export { datosFicha } from './datosFicha';
export { logoNavegador };

/** PNG del minimapa del árbol; null sin GPS. */
export async function minimapaDeArbol(
  arbol: ArbolParaFicha,
  puntos: readonly PuntoGps[],
): Promise<string | null> {
  const contenido = contenidoMinimapa(arbol, puntos);
  return contenido ? dibujarMapa(contenido) : null;
}

export async function renderizarFichas(props: DocumentoFichasProps): Promise<Blob> {
  registrarFuentes(archivosFuentesNavegador());
  return pdf(<DocumentoFichas {...props} />).toBlob();
}
