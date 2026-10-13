/*
 * Reporte PDF de árboles (#848, #849): tarjetas para los que tienen foto y un
 * listado para el resto, de todo lo que deja el filtro. Todo lo de PDF se carga
 * recién acá, con `import()`; el plan es puro y viene de entrada.
 */
import type { QueryClient } from '@tanstack/react-query';
import { ESTADO_FOTO, type FotoPdf } from '../pdf/estadoFoto';
import { repartirArboles, type ModoReporte } from '../pdf/reporte/planReporte';
import type { FiltrosArboles } from '../queries/dataExplorerQueries';
import { listarArbolesDelFiltro, type ArbolParaFicha } from '../queries/fichasQueries';
import type { Plantacion } from '../queries/plantationQueries';
import type { ColorEspecie } from '../theme/coloresEspecie';
import { leerColoresEspecie } from './coloresDePlantacion';
import { descargarBlob } from './descargas';
import { leerOrganizacionDelEncabezado } from './encabezadoPdf';

/** Las etapas de la barra de progreso; la lectura de los árboles la avisa quien los lee. */
export const ETAPA_REPORTE = {
  leyendoArboles: 'leyendo-arboles',
  bajandoFotos: 'bajando-fotos',
  armandoPdf: 'armando-pdf',
} as const;

export type ProgresoReporte =
  | { etapa: typeof ETAPA_REPORTE.leyendoArboles }
  | { etapa: typeof ETAPA_REPORTE.bajandoFotos; listas: number; total: number }
  | { etapa: typeof ETAPA_REPORTE.armandoPdf };

export type ContextoReportePdf = {
  plantacion: Pick<Plantacion, 'id' | 'lugar' | 'periodo' | 'codigo'>;
  /** Los colores de especie salen de su caché si ya se leyeron. */
  queryClient: QueryClient;
};

type Seguimiento = {
  alProgresar?: (progreso: ProgresoReporte) => void;
  /** Corta la lectura, la bajada de fotos o el armado del PDF, donde esté. */
  senal?: AbortSignal;
};

export type PedidoReporte = Seguimiento & {
  /** Por grupo y posición: así salen las tarjetas y el listado. */
  arboles: readonly ArbolParaFicha[];
  modo: ModoReporte;
};

export type ReportePdf = {
  blob: Blob;
  /** Tarjetas que salieron con «Foto no disponible». */
  fotosFallidas: number;
};

export const ERROR_REPORTE_SIN_ARBOLES = 'El reporte no tiene árboles';

function leerInsumos({ plantacion, queryClient }: ContextoReportePdf) {
  return Promise.all([
    leerOrganizacionDelEncabezado(plantacion.id),
    leerColoresEspecie(queryClient, plantacion.id),
    import('../pdf/reporte/motorReporte'),
  ]);
}

type MotorReporte = typeof import('../pdf/reporte/motorReporte');

async function bajarFotos(
  motor: MotorReporte,
  tarjetas: readonly ArbolParaFicha[],
  { alProgresar, senal }: Seguimiento,
): Promise<FotoPdf[]> {
  if (tarjetas.length === 0) return [];
  return motor.cargarFotos(
    tarjetas.map((arbol) => arbol.fotoUrl),
    {
      alProgresar: (listas, total) =>
        alProgresar?.({ etapa: ETAPA_REPORTE.bajandoFotos, listas, total }),
      senal,
    },
  );
}

/** Baja solo las fotos de los árboles que salen como tarjeta. */
async function prepararReparto(motor: MotorReporte, pedido: PedidoReporte, colorDe: ColorEspecie) {
  const { tarjetas, listado } = repartirArboles(pedido.arboles, pedido.modo);
  const fotos = await bajarFotos(motor, tarjetas, pedido);
  return {
    tarjetas: tarjetas.map((arbol, indice) => motor.datosTarjeta(arbol, fotos[indice], colorDe)),
    listado: listado.map((arbol) => motor.datosArbolReporte(arbol, colorDe)),
  };
}

function contarFallidas(tarjetas: ReadonlyArray<{ foto: FotoPdf }>): number {
  return tarjetas.filter(({ foto }) => foto.estado === ESTADO_FOTO.noDisponible).length;
}

/** El PDF del reporte; una foto que no se baja sale como «Foto no disponible» y se cuenta. */
export async function generarPdfReporte(
  pedido: PedidoReporte,
  contexto: ContextoReportePdf,
): Promise<ReportePdf> {
  if (pedido.arboles.length === 0) throw new Error(ERROR_REPORTE_SIN_ARBOLES);
  const [organizacion, colorDe, motor] = await leerInsumos(contexto);
  const reparto = await prepararReparto(motor, pedido, colorDe);
  pedido.senal?.throwIfAborted();
  pedido.alProgresar?.({ etapa: ETAPA_REPORTE.armandoPdf });
  const emision = motor.emisionDePlantacion(contexto.plantacion, organizacion);
  const blob = await motor.renderizarReporte({ ...emision, reparto }, pedido.senal);
  return { blob, fotosFallidas: contarFallidas(reparto.tarjetas) };
}

export type PedidoDescargaReporte = Seguimiento & {
  filtros: FiltrosArboles;
  modo: ModoReporte;
  nombreArchivo: string;
};

/** Lee todo lo que deja el filtro, arma el PDF y lo descarga. Cancelado, no descarga nada. */
export async function descargarReportePdf(
  { filtros, nombreArchivo, ...pedido }: PedidoDescargaReporte,
  contexto: ContextoReportePdf,
): Promise<Pick<ReportePdf, 'fotosFallidas'>> {
  pedido.alProgresar?.({ etapa: ETAPA_REPORTE.leyendoArboles });
  const arboles = await listarArbolesDelFiltro(contexto.plantacion.id, filtros, pedido.senal);
  const { blob, fotosFallidas } = await generarPdfReporte({ ...pedido, arboles }, contexto);
  // El PDF pudo llegar justo después de cancelar.
  pedido.senal?.throwIfAborted();
  descargarBlob(blob, nombreArchivo);
  return { fotosFallidas };
}
