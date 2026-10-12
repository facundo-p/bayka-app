import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useDescarga } from '../hooks/useDescarga';
import { BP, useMediaQuery } from '../hooks/useMediaQuery';
import { listarFilasExportacion } from '../queries/exportacionQueries';
import { listarPuntosGps } from '../queries/mapaQueries';
import type { Plantacion } from '../queries/plantationQueries';
import type { Perfil } from '../repositories/profileRepository';
import { leerColoresEspecie } from '../services/coloresDePlantacion';
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
import { ETIQUETA_MENU_ELIMINAR } from './plantaciones/eliminacion';
import { ETIQUETA_MENU_REABRIR, esReabrible, puedeReabrir } from './plantaciones/reapertura';
import { useInformePdf } from './plantaciones/useInformePdf';

const MENSAJE_SIN_PUNTOS = 'Esta plantación no tiene puntos GPS para exportar.';
const MENSAJE_ERROR_KML = 'No se pudieron cargar los puntos GPS.';
const MENSAJE_SIN_ARBOLES = 'Esta plantación no tiene árboles para exportar.';
const MENSAJE_ERROR_EXPORT = 'No se pudieron cargar los árboles para exportar.';

/** Descarga los puntos GPS como KML (Google Maps/Earth); no descarga si no hay puntos. */
function useDescargaKml(plantacion: Plantacion) {
  const queryClient = useQueryClient();
  return useDescarga(async () => {
    const puntos = await listarPuntosGps(plantacion.id);
    if (puntos.length === 0) return MENSAJE_SIN_PUNTOS;
    const colorDe = await leerColoresEspecie(queryClient, plantacion.id);
    const nombreDocumento = `Puntos GPS – ${plantacion.lugar} (${plantacion.periodo})`;
    const kml = construirKml(puntos, { nombreDocumento, colorDe });
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

/** «Informe PDF» abre el modal de opciones; la descarga arranca desde ahí. */
export type AccionInforme = { abrir: () => void; descargando: boolean };

export interface AccionesProps {
  kml: Descarga;
  xlsx: Descarga;
  csv: Descarga;
  pdf: AccionInforme;
  /** null = se puede editar; texto = por qué no (plantación archivada). Exportar sigue disponible. */
  motivoEdicion: string | null;
  onEditar: () => void;
  /** Archivar/desarchivar y eliminar; vacío si el perfil no puede. */
  administracion: AccionMenu[];
}

export type AccionMenu = {
  clave: string;
  etiqueta: string;
  onElegir: () => void;
  destructiva?: boolean;
};

/** Modales de administración que abre el menú «Más acciones». */
export const MODAL_ADMINISTRACION = {
  archivado: 'archivado',
  eliminacion: 'eliminacion',
  reapertura: 'reapertura',
} as const;

export type ModalAdministracion = (typeof MODAL_ADMINISTRACION)[keyof typeof MODAL_ADMINISTRACION];

/** Las descargas de la barra, con el mensaje que devuelva cualquiera. */
function useDescargasDetalle(plantacion: Plantacion) {
  const kml = useDescargaKml(plantacion);
  const xlsx = useDescargaPlanilla(plantacion, descargarXlsxExportacion);
  const csv = useDescargaPlanilla(plantacion, descargarCsvExportacion);
  const informe = useInformePdf(plantacion);
  const pdf = { abrir: informe.abrir, descargando: informe.descargando };
  const mensaje = xlsx.mensaje ?? csv.mensaje ?? kml.mensaje ?? informe.mensajeBarra;
  return { kml, xlsx, csv, pdf, mensaje, informe };
}

/** Solo superadmin, y solo sobre una finalizada que no esté archivada (#470). */
function accionReapertura(
  plantacion: Plantacion,
  perfil: Perfil | null,
  abrir: (modal: ModalAdministracion) => void,
): AccionMenu[] {
  if (!puedeReabrir(perfil) || !esReabrible(plantacion)) return [];
  return [
    {
      clave: MODAL_ADMINISTRACION.reapertura,
      etiqueta: ETIQUETA_MENU_REABRIR,
      onElegir: () => abrir(MODAL_ADMINISTRACION.reapertura),
    },
  ];
}

function accionesAdministracion(
  plantacion: Plantacion,
  perfil: Perfil | null,
  abrir: (modal: ModalAdministracion) => void,
): AccionMenu[] {
  return [
    ...accionReapertura(plantacion, perfil, abrir),
    {
      clave: MODAL_ADMINISTRACION.archivado,
      etiqueta: CONFIRMACION_ARCHIVADO[accionDeArchivado(plantacion)].etiquetaMenu,
      onElegir: () => abrir(MODAL_ADMINISTRACION.archivado),
    },
    {
      clave: MODAL_ADMINISTRACION.eliminacion,
      etiqueta: ETIQUETA_MENU_ELIMINAR,
      destructiva: true,
      onElegir: () => abrir(MODAL_ADMINISTRACION.eliminacion),
    },
  ];
}

/** Archivar/desarchivar y eliminar, con qué modal está abierto. Eliminar
 *  puede derivar en archivar, por eso comparten el estado. */
function useAdministracionDetalle(plantacion: Plantacion) {
  const { perfil } = useAuth();
  const [modalAdministracion, setModal] = useState<ModalAdministracion | null>(null);
  const administracion = puedeArchivar(perfil)
    ? accionesAdministracion(plantacion, perfil, setModal)
    : [];
  const abrirArchivado = () => setModal(MODAL_ADMINISTRACION.archivado);
  const cerrarModal = () => setModal(null);
  return { administracion, modalAdministracion, abrirArchivado, cerrarModal };
}

/** Descargas, el informe, administración y si la barra va plegada en un solo «⋯». */
export function useAccionesDetalle(plantacion: Plantacion, onEditar: () => void) {
  const { mensaje, informe, ...descargas } = useDescargasDetalle(plantacion);
  const { administracion, ...modales } = useAdministracionDetalle(plantacion);
  const { perfil } = useAuth();
  const acciones: AccionesProps = {
    ...descargas,
    motivoEdicion: motivoEdicion(perfil, plantacion),
    onEditar,
    administracion,
  };
  const plegado = useMediaQuery(BP.tablet);
  return { acciones, mensaje, plegado, informe, ...modales };
}
