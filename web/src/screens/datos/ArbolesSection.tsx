import {
  Cargando,
  CardTabla,
  ErrorConReintento,
  LayoutConPanel,
  Paginacion,
  Table,
} from '../../components';
import { ColoresEspecieContext } from '../../hooks/useColoresEspecie';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { AYUDA_FILA } from '../../lib/ayudaFila';
import { formatearEntero } from '../../lib/formato';
import { SEGMENTO_DATOS } from '../../lib/rutas';
import {
  ARBOLES_POR_PAGINA,
  type ArbolDetalle,
  type PaginaArboles,
} from '../../queries/dataExplorerQueries';
import { nombreArchivoFoto } from '../../services/descargas';
import { ArbolDetallePanel } from './ArbolDetallePanel';
import { ArbolesFiltros, BuscadorArboles } from './ArbolesFiltros';
import { BotonReportePdf } from './BotonReportePdf';
import { nombreTecnicoDe, parcelaDe } from './arbolFormato';
import { columnasArboles } from './columnas';
import { DatosToolbar } from './DatosToolbar';
import { ReportePdfModal } from './ReportePdfModal';
import { useArbolesSection } from './useArbolesSection';
import { useReportePdf, type EstadoReportePdf } from './useReportePdf';
import { useSoltarParcelaFantasma } from './useSoltarParcelaFantasma';
import { VacioConFiltros } from './VacioConFiltros';

type SeccionArboles = ReturnType<typeof useArbolesSection>;

const VACIO_CON_FILTROS = 'Ningún árbol coincide con los filtros';

/** Rango visible de la página actual, ej. "Mostrando 1–50 de 934". */
function rangoVisible(pagina: number, total: number): string {
  const desde = (pagina - 1) * ARBOLES_POR_PAGINA + 1;
  const hasta = Math.min(pagina * ARBOLES_POR_PAGINA, total);
  return `Mostrando ${formatearEntero(desde)}–${formatearEntero(hasta)} de ${formatearEntero(total)}`;
}

function pieTabla(pagina: number, datos: PaginaArboles): string | undefined {
  if (datos.total === 0) return undefined;
  return `${rangoVisible(pagina, datos.total)} · ${AYUDA_FILA.detalle}`;
}

/** Con el panel abierto la tabla suelta las columnas que el panel repite. */
function useColumnasArboles(seccion: SeccionArboles) {
  const columnas = columnasArboles(seccion.codigosParcela, seccion.nombresUsuario);
  return useColumnasVisibles(columnas, seccion.arbolSeleccionado !== null);
}

function TablaArboles({ seccion, datos }: { seccion: SeccionArboles; datos: PaginaArboles }) {
  const { pagina, setPagina } = seccion;
  const columnas = useColumnasArboles(seccion);
  const paginacion = (
    <Paginacion pagina={pagina} totalPaginas={datos.totalPaginas} onCambiar={setPagina} />
  );
  return (
    <CardTabla pie={pieTabla(pagina, datos)} acciones={datos.total > 0 && paginacion}>
      <Table
        columns={columnas}
        rows={datos.arboles}
        getRowKey={(arbol) => arbol.id}
        claveSeleccionada={seccion.arbolSeleccionado?.id}
        emptyMessage="Sin árboles para mostrar"
        onRowClick={seccion.setArbolSeleccionado}
      />
    </CardTabla>
  );
}

interface PanelArbolProps {
  seccion: SeccionArboles;
  arbol: ArbolDetalle;
}

/** Sin la plantación cargada no hay lugar ni periodo: null deshabilita la descarga. */
function nombreFotoDe(seccion: SeccionArboles, arbol: ArbolDetalle): string | null {
  const { plantacion } = seccion;
  return plantacion ? nombreArchivoFoto(plantacion.lugar, plantacion.periodo, arbol.subId) : null;
}

/** La key remonta el panel al cambiar de fila: la foto y el mapa se rearman. */
function PanelArbolSeleccionado({ seccion, arbol }: PanelArbolProps) {
  return (
    <ArbolDetallePanel
      key={arbol.id}
      arbol={arbol}
      parcela={parcelaDe(arbol, seccion.parcelasPorId)}
      tecnicoNombre={nombreTecnicoDe(arbol, seccion.nombresUsuario)}
      nombreFoto={nombreFotoDe(seccion, arbol)}
      descargarFicha={seccion.descargaFichaDe(arbol)}
      edicionDeEspecie={seccion.edicionDeEspecie}
      onCerrar={() => seccion.setArbolSeleccionado(null)}
    />
  );
}

function CuerpoArboles({ seccion }: { seccion: SeccionArboles }) {
  const { arboles, arbolSeleccionado: arbol } = seccion;
  if (!arboles.data || !seccion.colores.listo) return <Cargando label="Cargando árboles…" />;
  if (arboles.data.total === 0 && seccion.hayFiltroOBusqueda) {
    return <VacioConFiltros mensaje={VACIO_CON_FILTROS} onLimpiar={seccion.limpiarTodo} />;
  }
  const panel = arbol && <PanelArbolSeleccionado seccion={seccion} arbol={arbol} />;
  return (
    <ColoresEspecieContext value={seccion.colores.colorDe}>
      <LayoutConPanel panel={panel}>
        <TablaArboles seccion={seccion} datos={arboles.data} />
      </LayoutConPanel>
    </ColoresEspecieContext>
  );
}

/**
 * El reporte vive acá y no en la barra: la barra se rearma al cruzar el ancho
 * de teléfono (al rotarlo, por ejemplo) y se llevaría puesto un reporte a medias.
 */
function useReporteDeArboles(seccion: SeccionArboles) {
  const { parcelas, grupos, especies } = seccion;
  return useReportePdf({
    plantacion: seccion.plantacion,
    filtros: seccion.filtrosAplicados,
    catalogos: {
      parcelas: parcelas.data ?? [],
      grupos: grupos.data ?? [],
      especies: especies.data ?? [],
    },
    hayArboles: (seccion.arboles.data?.total ?? 0) > 0,
  });
}

interface ConReporte {
  seccion: SeccionArboles;
  reporte: EstadoReportePdf;
}

function ToolbarArboles({ seccion, reporte }: ConReporte) {
  const { parcelas, filtros, setFiltro } = seccion;
  useSoltarParcelaFantasma(parcelas.data ?? [], filtros.parcelaId, (valor) =>
    setFiltro('parcelaId', valor),
  );
  return (
    <DatosToolbar
      segmento={SEGMENTO_DATOS.arboles}
      tituloFiltros="Filtros de árboles"
      filtrosActivos={seccion.filtrosActivos}
      onLimpiar={seccion.limpiar}
      busqueda={<BuscadorArboles filtros={seccion.filtros} onCambiar={seccion.setFiltro} />}
      acciones={<BotonReportePdf reporte={reporte} />}
    >
      <ArbolesFiltros
        filtros={seccion.filtros}
        parcelas={seccion.parcelas.data ?? []}
        grupos={seccion.grupos.data ?? []}
        especies={seccion.especies.data ?? []}
        onCambiar={seccion.setFiltro}
      />
    </DatosToolbar>
  );
}

function ContenidoArboles({ seccion, reporte }: ConReporte) {
  const { arboles } = seccion;
  if (arboles.isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudieron cargar los árboles."
        onReintentar={() => void arboles.refetch()}
      />
    );
  }
  return (
    <>
      <ToolbarArboles seccion={seccion} reporte={reporte} />
      <CuerpoArboles seccion={seccion} />
    </>
  );
}

/** Sección Árboles de la tab Datos: toolbar + filtros + tabla paginada server-side. */
export function ArbolesSection() {
  const seccion = useArbolesSection();
  const reporte = useReporteDeArboles(seccion);
  return (
    <>
      <ContenidoArboles seccion={seccion} reporte={reporte} />
      <ReportePdfModal reporte={reporte} />
    </>
  );
}
