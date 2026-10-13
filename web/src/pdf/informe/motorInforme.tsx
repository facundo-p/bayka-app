/*
 * Punto de entrada del informe PDF: el service lo carga con `import()`, así
 * react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import { renderizarEnSerie } from '../plantilla/fuentes';
import { archivosFuentesNavegador } from '../plantilla/recursosNavegador';
import type { EmisionPdf } from '../plantilla/textos';
import { datosInforme, tieneMapa, type EntradaInforme, type ModeloInforme } from './datosInforme';
import { DocumentoInforme, type MapaDelDocumento } from './DocumentoInforme';
import { dibujarMapaInforme } from './mapaInforme';
import { planificarInforme } from './planificarInforme';

export { emisionDePlantacion } from '../plantilla/emision';

export type PedidoInforme = EntradaInforme & EmisionPdf;

/** Sin mapa elegido no hay plan ni imagen; sin puntos, no hay imagen. */
async function mapaDelDocumento(modelo: ModeloInforme): Promise<MapaDelDocumento | null> {
  if (!tieneMapa(modelo)) return null;
  const plan = planificarInforme(modelo);
  const contenido = modelo.mapa;
  const imagen = contenido.vacio ? null : await dibujarMapaInforme(contenido);
  return { contenido, plan, imagen };
}

/** Modelo, plan, mapa rasterizado y documento, en ese orden. */
export async function renderizarInforme({
  encabezado,
  emitido,
  ...entrada
}: PedidoInforme): Promise<Blob> {
  const modelo = datosInforme(entrada);
  const mapa = await mapaDelDocumento(modelo);
  const documento = <DocumentoInforme {...{ encabezado, emitido, modelo, mapa }} />;
  return renderizarEnSerie(archivosFuentesNavegador(), () => pdf(documento).toBlob());
}
