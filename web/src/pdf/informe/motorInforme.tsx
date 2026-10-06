/*
 * Punto de entrada del informe PDF: el service lo carga con `import()`, así
 * react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import { renderizarEnSerie } from '../plantilla/fuentes';
import { archivosFuentesNavegador, logoNavegador } from '../plantilla/recursosNavegador';
import { encabezadoDePlantacion } from '../plantilla/textos';
import { datosInforme, type EntradaInforme } from './datosInforme';
import { DocumentoInforme } from './DocumentoInforme';
import { dibujarMapaInforme } from './mapaInforme';
import { planificarInforme } from './planificarInforme';

export type PedidoInforme = EntradaInforme & { emitido: string };

/** Modelo, plan, mapa rasterizado y documento, en ese orden. */
export async function renderizarInforme({ emitido, ...entrada }: PedidoInforme): Promise<Blob> {
  const modelo = datosInforme(entrada);
  const plan = planificarInforme(modelo);
  const mapa = modelo.mapa.vacio ? null : await dibujarMapaInforme(modelo.mapa, plan.disponible);
  const encabezado = encabezadoDePlantacion(
    entrada.plantacion,
    entrada.organizacion,
    logoNavegador(),
  );
  const documento = <DocumentoInforme {...{ encabezado, emitido, modelo, plan, mapa }} />;
  return renderizarEnSerie(archivosFuentesNavegador(), () => pdf(documento).toBlob());
}
