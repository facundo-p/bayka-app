import {
  Cargando,
  CardTabla,
  ErrorConReintento,
  LayoutConPanel,
  Paginacion,
  Table,
} from '../../components';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { formatearEntero } from '../../lib/formato';
import { SEGMENTO_DATOS } from '../../lib/rutas';
import {
  ARBOLES_POR_PAGINA,
  type ArbolDetalle,
  type PaginaArboles,
} from '../../queries/dataExplorerQueries';
import { ArbolDetallePanel } from './ArbolDetallePanel';
import { ArbolesFiltros } from './ArbolesFiltros';
import { codigoParcelaDe, nombreTecnicoDe } from './arbolFormato';
import { columnasArboles } from './columnas';
import { DatosToolbar } from './DatosToolbar';
import { useArbolesSection } from './useArbolesSection';
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
  return `${rangoVisible(pagina, datos.total)} · clic en una fila abre el detalle al costado`;
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

/** La key remonta el panel al cambiar de fila: la foto y el mapa se rearman. */
function PanelArbolSeleccionado({ seccion, arbol }: PanelArbolProps) {
  return (
    <ArbolDetallePanel
      key={arbol.id}
      arbol={arbol}
      parcelaCodigo={codigoParcelaDe(arbol, seccion.codigosParcela)}
      tecnicoNombre={nombreTecnicoDe(arbol, seccion.nombresUsuario)}
      onCerrar={() => seccion.setArbolSeleccionado(null)}
    />
  );
}

function CuerpoArboles({ seccion }: { seccion: SeccionArboles }) {
  const { arboles, arbolSeleccionado: arbol } = seccion;
  if (!arboles.data) return <Cargando label="Cargando árboles…" />;
  if (arboles.data.total === 0 && seccion.hayFiltro) {
    return <VacioConFiltros mensaje={VACIO_CON_FILTROS} onLimpiar={seccion.limpiar} />;
  }
  const panel = arbol && <PanelArbolSeleccionado seccion={seccion} arbol={arbol} />;
  return (
    <LayoutConPanel panel={panel}>
      <TablaArboles seccion={seccion} datos={arboles.data} />
    </LayoutConPanel>
  );
}

function ToolbarArboles({ seccion }: { seccion: SeccionArboles }) {
  return (
    <DatosToolbar segmento={SEGMENTO_DATOS.arboles}>
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

/** Sección Árboles de la tab Datos: toolbar + filtros + tabla paginada server-side. */
export function ArbolesSection() {
  const seccion = useArbolesSection();
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
      <ToolbarArboles seccion={seccion} />
      <CuerpoArboles seccion={seccion} />
    </>
  );
}
