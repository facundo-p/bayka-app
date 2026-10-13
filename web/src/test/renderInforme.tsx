/*
 * El informe en node, por el camino del motor: los textos en renglones con las
 * fuentes ya leídas, el plan y el documento, todo en el mismo turno. Con un PNG
 * cualquiera en lugar del canvas del mapa.
 */
import { Document, renderToBuffer } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { datosInforme, tieneMapa, type EntradaInforme } from '../pdf/informe/datosInforme';
import { DocumentoInforme, type MapaDelDocumento } from '../pdf/informe/DocumentoInforme';
import {
  planificarInforme,
  UBICACION_MAPA,
  type PlanInforme,
  type UbicacionMapa,
} from '../pdf/informe/planificarInforme';
import {
  informeEnRenglones,
  leerMedidoresInforme,
  type InformeEnRenglones,
  type MedidoresInforme,
} from '../pdf/informe/renglonesInforme';
import { ESTADO_MAPA } from '../pdf/mapa/estadoMapa';
import { renderizarEnSerie } from '../pdf/plantilla/fuentes';
import { Hoja } from '../pdf/plantilla/Hoja';
import { encabezadoDePlantacion } from '../pdf/plantilla/textos';
import { FUENTES_NODE, LOGO_NODE, paginasDelPdf, PNG_DE_PRUEBA } from './pdfNode';
import { textosDelPdf } from './textoPdf';

export type VarianteInforme = {
  conSatelite?: boolean;
  ubicacion?: UbicacionMapa;
  /** Sin ellos, los de las fuentes reales, como en el motor. */
  medidores?: MedidoresInforme;
};

function mapaDe(modelo: InformeEnRenglones, variante: VarianteInforme): MapaDelDocumento | null {
  if (!tieneMapa(modelo)) return null;
  const plan = variante.ubicacion ? { ubicacion: variante.ubicacion } : planificarInforme(modelo);
  const conSatelite = variante.conSatelite ?? false;
  const imagen = modelo.mapa.vacio
    ? null
    : { mapa: { estado: ESTADO_MAPA.listo, src: PNG_DE_PRUEBA, conSatelite } };
  return { contenido: modelo.mapa, plan, imagen };
}

/** El PDF, sus textos, el plan del mapa y el modelo en renglones con que se armó. */
export async function armarInforme(entrada: EntradaInforme, variante: VarianteInforme = {}) {
  const datos = datosInforme(entrada);
  const encabezado = encabezadoDePlantacion(entrada.plantacion, entrada.organizacion, LOGO_NODE);
  let armado: { modelo: InformeEnRenglones; plan: PlanInforme | null } | undefined;
  const pdf = await renderizarEnSerie(FUENTES_NODE, async () => {
    const medidores = variante.medidores ?? (await leerMedidoresInforme());
    const modelo = informeEnRenglones(datos, medidores);
    const mapa = mapaDe(modelo, variante);
    armado = { modelo, plan: mapa?.plan ?? null };
    return renderToBuffer(
      <DocumentoInforme {...{ encabezado, emitido: '06/10/2026', modelo, mapa }} />,
    );
  });
  return { pdf, textos: textosDelPdf(pdf), ...armado! };
}

/** La misma entrada sin el mapa: para contar las hojas del resto. */
export const sinMapa = (entrada: EntradaInforme): EntradaInforme => ({
  ...entrada,
  opciones: { ...entrada.opciones, mapa: false },
});

/** Con el mapa forzado al pie, ¿el informe ocupa las mismas hojas que sin mapa? */
export async function entraAlPie(entrada: EntradaInforme) {
  const alPie = await armarInforme(entrada, { ubicacion: UBICACION_MAPA.ultimaHoja });
  const soloElResto = await armarInforme(sinMapa(entrada));
  return paginasDelPdf(alPie.pdf) === paginasDelPdf(soloElResto.pdf);
}

/** Las hojas que ocupa un cuerpo puesto en una hoja del informe: si no entra, salen más. */
export async function hojasQueOcupa(cuerpo: ReactNode) {
  const plantacion = { lugar: 'San Sebastián', periodo: '2025-2026', codigo: 'SS26' };
  const encabezado = encabezadoDePlantacion(plantacion, null, LOGO_NODE);
  const pdf = await renderizarEnSerie(FUENTES_NODE, () =>
    renderToBuffer(
      <Document>
        <Hoja encabezado={encabezado} documento="Informe" emitido="06/10/2026">
          {cuerpo}
        </Hoja>
      </Document>,
    ),
  );
  return paginasDelPdf(pdf);
}
