/* Textos del botón y del modal del reporte PDF de árboles (#849): puros, para testearlos sin render. */
import { formatearEntero, formatearPeso, pluralizar, PORCENTAJE_COMPLETO } from '../../lib/formato';
import { SUSTANTIVO } from '../../lib/sustantivos';
import { TEXTO_ARBOL } from '../../pdf/arbol/textosArbol';
import { TOPE_TARJETAS, type EstimacionReporte } from '../../pdf/reporte/planReporte';
import type { ConteoDelFiltro } from '../../queries/dataExplorerQueries';
import { ETAPA_REPORTE, type ProgresoReporte } from '../../services/pdfReporte';

export const TEXTO_REPORTE_PDF = {
  boton: 'Reporte PDF',
  botonDescripcion: 'Reporte PDF de todos los árboles del filtro',
  titulo: 'Reporte PDF de árboles',
  descripcion: 'Incluye todos los árboles que deja el filtro, no solo los de esta página.',
  contando: 'Contando árboles…',
  errorConteo: 'No se pudieron contar los árboles.',
  reintentar: 'Reintentar',
  grupoModo: 'Fotos en el reporte',
  conFotos: 'Con fotos',
  sinFotos: 'Sin fotos',
  sublabelSinFotos: 'Todo en el listado',
  sinArbolesConFoto: 'Ningún árbol con foto',
  generar: 'Generar PDF',
  generando: 'Generando…',
  error: 'No se pudo generar el reporte.',
  listo: 'Listo',
  leyendo: 'Leyendo árboles…',
  bajando: 'Bajando fotos…',
  barraFotos: 'Fotos bajadas',
  armando: 'Armando el PDF…',
  armandoDetalle: 'Puede tardar unos segundos.',
} as const;

/** «148 árboles en el filtro, 37 con foto.» */
export function textoResumenConteo({ total, conFoto }: ConteoDelFiltro): string {
  return `${pluralizar(total, SUSTANTIVO.arbol)} en el filtro, ${formatearEntero(conFoto)} con foto.`;
}

/** Sublabel de «Con fotos»: las que salen como tarjeta, ya con el tope. */
export function textoTarjetas(tarjetas: number): string {
  return tarjetas === 0
    ? TEXTO_REPORTE_PDF.sinArbolesConFoto
    : pluralizar(tarjetas, SUSTANTIVO.tarjetaConFoto);
}

/** «12 hojas · ≈ 2,1 MB». */
export function textoEstimacion({ hojas }: EstimacionReporte, pesoBytes: number): string {
  return `${pluralizar(hojas, SUSTANTIVO.hoja)} · ≈ ${formatearPeso(pesoBytes)}`;
}

/** null mientras las fotos entren en el tope. */
export function textoAvisoTope(conFoto: number): string | null {
  if (conFoto <= TOPE_TARJETAS) return null;
  const resto = conFoto - TOPE_TARJETAS;
  return (
    `Hay ${formatearEntero(conFoto)} árboles con foto: solo los primeros ` +
    `${formatearEntero(TOPE_TARJETAS)} salen como tarjeta. Los otros ` +
    `${formatearEntero(resto)} van al listado, sin foto.`
  );
}

export function textoProgreso(progreso: ProgresoReporte): string {
  switch (progreso.etapa) {
    case ETAPA_REPORTE.leyendoArboles:
      return TEXTO_REPORTE_PDF.leyendo;
    case ETAPA_REPORTE.bajandoFotos:
      return `Bajando fotos: ${formatearEntero(progreso.listas)} de ${formatearEntero(progreso.total)}`;
    case ETAPA_REPORTE.armandoPdf:
      return TEXTO_REPORTE_PDF.armando;
  }
}

/** Lo que anuncian los lectores de pantalla: cambia con la etapa, no con cada foto. */
export function textoEtapa(progreso: ProgresoReporte): string {
  if (progreso.etapa === ETAPA_REPORTE.bajandoFotos) return TEXTO_REPORTE_PDF.bajando;
  return textoProgreso(progreso);
}

/** Solo la bajada de fotos tiene un avance que medir. */
export function porcentajeDeFotos(progreso: ProgresoReporte): number | null {
  if (progreso.etapa !== ETAPA_REPORTE.bajandoFotos || progreso.total === 0) return null;
  return (progreso.listas / progreso.total) * PORCENTAJE_COMPLETO;
}

/** Lo que se avisa al terminar si hubo fotos que no se pudieron bajar. */
export function textoFotosFallidas(fallidas: number): string {
  const verbo = fallidas === 1 ? 'no se pudo bajar y salió' : 'no se pudieron bajar y salieron';
  return (
    `El reporte se descargó, pero ${pluralizar(fallidas, SUSTANTIVO.foto)} ${verbo} ` +
    `como «${TEXTO_ARBOL.fotoNoDisponible}».`
  );
}
