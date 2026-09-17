import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useDescarga } from '../hooks/useDescarga';
import { BP, useMediaQuery } from '../hooks/useMediaQuery';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarFilasExportacion } from '../queries/exportacionQueries';
import { idsGenerados } from '../queries/idsQueries';
import { listarPuntosGps } from '../queries/mapaQueries';
import type { Plantacion } from '../queries/plantationQueries';
import { descargarTexto } from '../services/descargas';
import { descargarCsvExportacion } from '../services/exportarCsv';
import { construirKml, nombreArchivoKml, TIPO_MIME_KML } from '../services/exportarKml';
import { descargarXlsxExportacion } from '../services/exportarXlsx';
import {
  accionDeArchivado,
  CONFIRMACION_ARCHIVADO,
  motivoEdicion,
  puedeArchivar,
} from './plantaciones/archivado';

const MENSAJE_SIN_PUNTOS = 'Esta plantación no tiene puntos GPS para exportar.';
const MENSAJE_ERROR_KML = 'No se pudieron cargar los puntos GPS.';
const MENSAJE_SIN_ARBOLES = 'Esta plantación no tiene árboles para exportar.';
const MENSAJE_ERROR_EXPORT = 'No se pudieron cargar los árboles para exportar.';

/** Descarga los puntos GPS como KML (Google Maps/Earth); no descarga si no hay puntos. */
function useDescargaKml(plantacion: Plantacion) {
  return useDescarga(async () => {
    const puntos = await listarPuntosGps(plantacion.id);
    if (puntos.length === 0) return MENSAJE_SIN_PUNTOS;
    const nombreDocumento = `Puntos GPS – ${plantacion.lugar} (${plantacion.periodo})`;
    const kml = construirKml(puntos, { nombreDocumento });
    descargarTexto(kml, nombreArchivoKml(plantacion.lugar, plantacion.periodo), TIPO_MIME_KML);
    return null;
  }, MENSAJE_ERROR_KML);
}

/** Serializador de planilla: recibe las filas ya cargadas y dispara la descarga. */
type DescargarPlanilla = (
  filas: Awaited<ReturnType<typeof listarFilasExportacion>>,
  lugar: string,
  periodo: string,
) => void | Promise<void>;

/** Descarga los árboles como planilla (CSV o XLSX según el serializador); no descarga si no hay árboles. */
function useDescargaPlanilla(plantacion: Plantacion, descargarPlanilla: DescargarPlanilla) {
  return useDescarga(async () => {
    const filas = await listarFilasExportacion(plantacion.id);
    if (filas.length === 0) return MENSAJE_SIN_ARBOLES;
    await descargarPlanilla(filas, plantacion.lugar, plantacion.periodo);
    return null;
  }, MENSAJE_ERROR_EXPORT);
}

type Descarga = ReturnType<typeof useDescargaKml>;

export interface AccionesProps {
  kml: Descarga;
  xlsx: Descarga;
  csv: Descarga;
  /** Las planillas necesitan los IDs definitivos; el KML no. */
  idsPendientes: boolean;
  /** null = se puede editar; texto = por qué no (plantación archivada). Exportar sigue disponible. */
  motivoEdicion: string | null;
  onEditar: () => void;
  /** Solo la web genera los IDs, server-side vía RPC (#232). */
  onGenerarIds: () => void;
  /** Archivar o desarchivar; null si el perfil no puede. */
  archivado: { etiqueta: string; onElegir: () => void } | null;
}

/** Las tres descargas de la barra, con el mensaje que devuelva cualquiera. */
function useDescargasDetalle(plantacion: Plantacion) {
  const kml = useDescargaKml(plantacion);
  const xlsx = useDescargaPlanilla(plantacion, descargarXlsxExportacion);
  const csv = useDescargaPlanilla(plantacion, descargarCsvExportacion);
  return { kml, xlsx, csv, mensaje: xlsx.mensaje ?? csv.mensaje ?? kml.mensaje };
}

/** Mientras la consulta no responde no se ofrece generar: solo con un `false` explícito. */
function useIdsPendientes(plantationId: string): boolean {
  const { data: generados } = useQuery({
    queryKey: CLAVE_QUERY.idsGenerados(plantationId),
    queryFn: () => idsGenerados(plantationId),
  });
  return generados === false;
}

/** La acción de archivado que le toca a la plantación, y si su confirmación está abierta. */
function useArchivadoDetalle(plantacion: Plantacion) {
  const { perfil } = useAuth();
  const [confirmandoArchivado, setConfirmandoArchivado] = useState(false);
  const archivado = puedeArchivar(perfil)
    ? {
        etiqueta: CONFIRMACION_ARCHIVADO[accionDeArchivado(plantacion)].etiquetaMenu,
        onElegir: () => setConfirmandoArchivado(true),
      }
    : null;
  const cerrarArchivado = () => setConfirmandoArchivado(false);
  return { archivado, confirmandoArchivado, cerrarArchivado };
}

/** Descargas, generación de IDs, archivado y si la barra va plegada en un solo «⋯». */
export function useAccionesDetalle(plantacion: Plantacion, onEditar: () => void) {
  const { mensaje, ...descargas } = useDescargasDetalle(plantacion);
  const { archivado, ...confirmacionArchivado } = useArchivadoDetalle(plantacion);
  const [generandoIds, setGenerandoIds] = useState(false);
  const acciones: AccionesProps = {
    ...descargas,
    idsPendientes: useIdsPendientes(plantacion.id),
    motivoEdicion: motivoEdicion(plantacion),
    onEditar,
    onGenerarIds: () => setGenerandoIds(true),
    archivado,
  };
  const cerrarGenerarIds = () => setGenerandoIds(false);
  const plegado = useMediaQuery(BP.tablet);
  return { acciones, mensaje, plegado, generandoIds, cerrarGenerarIds, ...confirmacionArchivado };
}
