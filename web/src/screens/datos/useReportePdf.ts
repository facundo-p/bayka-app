import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { estimarPeso } from '../../pdf/reporte/pesoReporte';
import { estimarReporte, MODO_REPORTE, type ModoReporte } from '../../pdf/reporte/planReporte';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import {
  contarArbolesDelFiltro,
  type ConteoDelFiltro,
  type FiltrosArboles,
} from '../../queries/dataExplorerQueries';
import type { Plantacion } from '../../queries/plantationQueries';
import { nombreArchivoReporte, type CatalogosDelNombre } from '../../services/nombreArchivoReporte';
import {
  descargarReportePdf,
  ETAPA_REPORTE,
  type ProgresoReporte,
} from '../../services/pdfReporte';
import { TEXTO_REPORTE_PDF } from './textosReportePdf';

/** En qué está el modal: eligiendo el modo, generando el PDF o avisando cómo salió. */
export const FASE_REPORTE = {
  eligiendo: 'eligiendo',
  generando: 'generando',
  terminado: 'terminado',
} as const;

export type EstadoReporte =
  | { fase: typeof FASE_REPORTE.eligiendo; error: string | null }
  | { fase: typeof FASE_REPORTE.generando; progreso: ProgresoReporte }
  | { fase: typeof FASE_REPORTE.terminado; fotosFallidas: number };

const ELIGIENDO: EstadoReporte = { fase: FASE_REPORTE.eligiendo, error: null };

export type ReportePdfProps = {
  plantacion: Pick<Plantacion, 'id' | 'lugar' | 'periodo' | 'codigo'>;
  /** Los del listado, con la búsqueda ya aplicada. */
  filtros: FiltrosArboles;
  catalogos: CatalogosDelNombre;
};

/** Los conteos se piden al abrir: el modal los muestra antes de leer los árboles. */
function useConteoReporte(plantationId: string, filtros: FiltrosArboles, abierto: boolean) {
  return useQuery({
    queryKey: CLAVE_QUERY.conteoReporte(plantationId, filtros),
    queryFn: () => contarArbolesDelFiltro(plantationId, filtros),
    enabled: abierto,
  });
}

/**
 * Sin árboles con foto, «Con fotos» no aplica y queda «Sin fotos» aunque se haya
 * elegido. `tarjetasConFotos` es lo que daría «Con fotos», ya con el tope.
 */
function useEleccion(conteo: ConteoDelFiltro | undefined) {
  const [elegido, setElegido] = useState<ModoReporte>(MODO_REPORTE.conFotos);
  const modo = conteo?.conFoto === 0 ? MODO_REPORTE.sinFotos : elegido;
  const estimacion = conteo && estimarReporte({ ...conteo, modo });
  return {
    modo,
    elegir: setElegido,
    estimacion,
    peso: estimacion && estimarPeso(estimacion),
    tarjetasConFotos: conteo && estimarReporte({ ...conteo, modo: MODO_REPORTE.conFotos }).tarjetas,
  };
}

/** Cancelar vale hasta que empieza el armado del PDF, que no se puede cortar. */
export function esCancelable(estado: EstadoReporte): boolean {
  return (
    estado.fase !== FASE_REPORTE.generando || estado.progreso.etapa !== ETAPA_REPORTE.armandoPdf
  );
}

type Generacion = {
  props: ReportePdfProps;
  modo: ModoReporte;
  alTerminar: () => void;
};

function pedidoDeDescarga({ plantacion, filtros, catalogos }: ReportePdfProps, modo: ModoReporte) {
  const { lugar, periodo } = plantacion;
  return { filtros, modo, nombreArchivo: nombreArchivoReporte(lugar, periodo, filtros, catalogos) };
}

/** Salir de la pantalla a mitad de camino corta la lectura y las fotos, como «Cancelar». */
function useAbortador() {
  const control = useRef<AbortController | null>(null);
  useEffect(() => () => control.current?.abort(), []);
  return {
    nuevo: () => (control.current = new AbortController()),
    abortar: () => control.current?.abort(),
  };
}

/**
 * Sin fotos fallidas, al terminar cierra; con fallidas, el modal lo avisa.
 * Cancelado, no avisa nada: ni el error ni el avance de una foto que ya venía.
 */
function useGeneracion({ props, modo, alTerminar }: Generacion) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoReporte>(ELIGIENDO);
  const abortador = useAbortador();
  const correr = async () => {
    const { signal } = abortador.nuevo();
    const alProgresar = (progreso: ProgresoReporte) => {
      if (!signal.aborted) setEstado({ fase: FASE_REPORTE.generando, progreso });
    };
    alProgresar({ etapa: ETAPA_REPORTE.leyendoArboles });
    try {
      const pedido = { ...pedidoDeDescarga(props, modo), alProgresar, senal: signal };
      const contexto = { plantacion: props.plantacion, queryClient };
      const { fotosFallidas } = await descargarReportePdf(pedido, contexto);
      setEstado(fotosFallidas > 0 ? { fase: FASE_REPORTE.terminado, fotosFallidas } : ELIGIENDO);
      if (fotosFallidas === 0) alTerminar();
    } catch {
      if (!signal.aborted)
        setEstado({ fase: FASE_REPORTE.eligiendo, error: TEXTO_REPORTE_PDF.error });
    }
  };
  const reiniciar = () => {
    abortador.abortar();
    setEstado(ELIGIENDO);
  };
  return { estado, generar: () => void correr(), reiniciar };
}

/**
 * El modal del reporte: conteos del filtro, modo de fotos, estimación de hojas y
 * peso, y la generación con su progreso.
 */
export function useReportePdf(props: ReportePdfProps) {
  const [abierto, setAbierto] = useState(false);
  const conteo = useConteoReporte(props.plantacion.id, props.filtros, abierto);
  const eleccion = useEleccion(conteo.data);
  const alTerminar = () => setAbierto(false);
  const { estado, generar, reiniciar } = useGeneracion({ props, modo: eleccion.modo, alTerminar });
  const cancelable = esCancelable(estado);
  const cerrar = () => {
    if (!cancelable) return;
    reiniciar();
    setAbierto(false);
  };
  const abrir = () => setAbierto(true);
  return { abierto, abrir, cerrar, conteo, ...eleccion, estado, cancelable, generar };
}

export type EstadoReportePdf = ReturnType<typeof useReportePdf>;
