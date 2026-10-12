import { useEffect, useRef, useState } from 'react';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
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
  type ContextoReportePdf,
  type PedidoDescargaReporte,
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

type PlantacionDelReporte = Pick<Plantacion, 'id' | 'lugar' | 'periodo' | 'codigo'>;

export type ReportePdfProps = {
  /** Sin la plantación no hay lugar ni periodo para el nombre: no se puede abrir. */
  plantacion: PlantacionDelReporte | null | undefined;
  /** Los del listado, con la búsqueda ya aplicada. */
  filtros: FiltrosArboles;
  catalogos: CatalogosDelNombre;
  /** Sin árboles en el filtro no hay qué reportar. */
  hayArboles: boolean;
};

/** Los conteos se piden al abrir: el modal los muestra antes de leer los árboles. */
function useConteoReporte(
  plantationId: string | undefined,
  filtros: FiltrosArboles,
  abierto: boolean,
) {
  return useQuery({
    queryKey: CLAVE_QUERY.conteoReporte(plantationId ?? '', filtros),
    queryFn: plantationId ? () => contarArbolesDelFiltro(plantationId, filtros) : skipToken,
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

function pedidoDeDescarga(
  { lugar, periodo }: PlantacionDelReporte,
  { filtros, catalogos }: ReportePdfProps,
  modo: ModoReporte,
) {
  return { filtros, modo, nombreArchivo: nombreArchivoReporte(lugar, periodo, filtros, catalogos) };
}

/**
 * Una corrida a la vez: la nueva corta la anterior. Salir de la pantalla a mitad
 * de camino la corta, como «Cancelar».
 */
function useAbortador() {
  const control = useRef<AbortController | null>(null);
  useEffect(() => () => control.current?.abort(), []);
  return {
    nuevo: () => {
      control.current?.abort();
      control.current = new AbortController();
      return control.current.signal;
    },
    abortar: () => control.current?.abort(),
  };
}

type Avisos = {
  mostrar: (estado: EstadoReporte) => void;
  /** Sin fotos fallidas no hay nada que avisar: el modal se cierra. */
  cerrar: () => void;
};

/** Cortada la corrida, lo que llegue tarde —un error, el avance de una foto, el final— no se aplica. */
function avisosDe(senal: AbortSignal, { mostrar, cerrar }: Avisos): Avisos {
  return {
    mostrar: (estado) => {
      if (!senal.aborted) mostrar(estado);
    },
    cerrar: () => {
      if (senal.aborted) return;
      cerrar();
    },
  };
}

type PedidoBase = Omit<PedidoDescargaReporte, 'alProgresar' | 'senal'>;

/** Cancelada, no avisa nada ni deja rastro: no es un error. */
async function correr(
  pedido: PedidoBase,
  senal: AbortSignal,
  contexto: ContextoReportePdf,
  { mostrar, cerrar }: Avisos,
) {
  const alProgresar = (progreso: ProgresoReporte) =>
    mostrar({ fase: FASE_REPORTE.generando, progreso });
  try {
    const { fotosFallidas } = await descargarReportePdf(
      { ...pedido, alProgresar, senal },
      contexto,
    );
    if (fotosFallidas > 0) mostrar({ fase: FASE_REPORTE.terminado, fotosFallidas });
    else cerrar();
  } catch (error) {
    if (senal.aborted) return;
    console.error(error);
    mostrar({ fase: FASE_REPORTE.eligiendo, error: TEXTO_REPORTE_PDF.error });
  }
}

type Generacion = {
  props: ReportePdfProps;
  modo: ModoReporte;
  alCerrar: () => void;
};

/** Cada corrida corta la anterior: nunca quedan dos vivas. Cerrar corta la que esté. */
function useGeneracion({ props, modo, alCerrar }: Generacion) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoReporte>(ELIGIENDO);
  const abortador = useAbortador();
  const cerrar = () => {
    abortador.abortar();
    setEstado(ELIGIENDO);
    alCerrar();
  };
  const generar = () => {
    const { plantacion } = props;
    if (!plantacion) return;
    const senal = abortador.nuevo();
    const pedido = pedidoDeDescarga(plantacion, props, modo);
    const avisos = avisosDe(senal, { mostrar: setEstado, cerrar });
    void correr(pedido, senal, { plantacion, queryClient }, avisos);
  };
  return { estado, generar, cerrar };
}

/**
 * El modal del reporte: conteos del filtro, modo de fotos, estimación de hojas y
 * peso, y la generación con su progreso. Cerrarlo corta la generación en
 * cualquier etapa.
 */
export function useReportePdf(props: ReportePdfProps) {
  const [abierto, setAbierto] = useState(false);
  const conteo = useConteoReporte(props.plantacion?.id, props.filtros, abierto);
  const eleccion = useEleccion(conteo.data);
  const alCerrar = () => setAbierto(false);
  const { estado, generar, cerrar } = useGeneracion({ props, modo: eleccion.modo, alCerrar });
  const disponible = Boolean(props.plantacion) && props.hayArboles;
  const abrir = () => setAbierto(true);
  return { disponible, abierto, abrir, cerrar, conteo, ...eleccion, estado, generar };
}

export type EstadoReportePdf = ReturnType<typeof useReportePdf>;
