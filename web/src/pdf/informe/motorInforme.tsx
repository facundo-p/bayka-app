/*
 * Punto de entrada del informe PDF: el service lo carga con `import()`, así
 * react-pdf y todo `pdf/` quedan fuera del bundle inicial.
 */
import { pdf } from '@react-pdf/renderer';
import { renderizarSaneado } from '../plantilla/fuentes';
import { archivosFuentesNavegador } from '../plantilla/recursosNavegador';
import type { EmisionPdf } from '../plantilla/textos';
import { datosInforme, tieneMapa, type EntradaInforme, type ModeloInforme } from './datosInforme';
import { DocumentoInforme, type MapaDelDocumento } from './DocumentoInforme';
import { dibujarMapaInforme, type MapaInformePdf } from './mapaInforme';
import { planificarInforme } from './planificarInforme';
import {
  informeEnRenglones,
  leerMedidoresInforme,
  type InformeEnRenglones,
} from './renglonesInforme';

export { emisionDePlantacion } from '../plantilla/emision';

export type PedidoInforme = EntradaInforme & EmisionPdf;

/** Sin mapa elegido o sin puntos, no hay imagen. */
async function imagenDelMapa(modelo: ModeloInforme): Promise<MapaInformePdf | null> {
  if (!tieneMapa(modelo) || modelo.mapa.vacio) return null;
  return dibujarMapaInforme(modelo.mapa);
}

/** Sin mapa elegido no hay plan: el plan cuenta los renglones de cada texto. */
function mapaDelDocumento(
  modelo: InformeEnRenglones,
  imagen: MapaInformePdf | null,
): MapaDelDocumento | null {
  if (!tieneMapa(modelo)) return null;
  return { contenido: modelo.mapa, plan: planificarInforme(modelo), imagen };
}

/**
 * Modelo y mapa rasterizado; después, con las fuentes leídas, los textos
 * saneados y en renglones, el plan y el documento.
 */
export async function renderizarInforme({
  encabezado,
  emitido,
  ...entrada
}: PedidoInforme): Promise<Blob> {
  const datos = datosInforme(entrada);
  const imagen = await imagenDelMapa(datos);
  // Se sanea antes de partir en renglones: se mide lo que se va a dibujar.
  const props = { encabezado, emitido, datos };
  return renderizarSaneado(
    archivosFuentesNavegador(),
    props,
    async ({ datos: saneados, ...emision }) => {
      const modelo = informeEnRenglones(saneados, await leerMedidoresInforme());
      const mapa = mapaDelDocumento(modelo, imagen);
      return pdf(<DocumentoInforme {...emision} modelo={modelo} mapa={mapa} />).toBlob();
    },
  );
}
