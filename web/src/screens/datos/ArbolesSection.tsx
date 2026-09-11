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
import { SEGMENTO_DATOS } from './seccionesDatos';
import { useArbolesSection } from './useArbolesSection';
import { VacioConFiltros } from './VacioConFiltros';

type SeccionArboles = ReturnType<typeof useArbolesSection>;

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

function TablaArboles({ seccion, datos }: { seccion: SeccionArboles; datos: PaginaArboles }) {
  const { pagina, setPagina, arbolSeleccionado } = seccion;
  const columnas = useColumnasVisibles(
    columnasArboles(seccion.codigosParcela, seccion.nombresUsuario),
    arbolSeleccionado !== null,
  );
  const paginacion = (
    <Paginacion pagina={pagina} totalPaginas={datos.totalPaginas} onCambiar={setPagina} />
  );
  return (
    <CardTabla pie={pieTabla(pagina, datos)} acciones={datos.total > 0 && paginacion}>
      <Table
        columns={columnas}
        rows={datos.arboles}
        getRowKey={(arbol) => arbol.id}
        claveSeleccionada={arbolSeleccionado?.id}
        emptyMessage="Sin árboles para mostrar"
        onRowClick={seccion.setArbolSeleccionado}
      />
    </CardTabla>
  );
}

function PanelArbolSeleccionado({ seccion, arbol }: { seccion: SeccionArboles; arbol: ArbolDetalle }) {
  return (
    <ArbolDetallePanel
      arbol={arbol}
      parcelaCodigo={codigoParcelaDe(arbol, seccion.codigosParcela)}
      tecnicoNombre={nombreTecnicoDe(arbol, seccion.nombresUsuario)}
      onCerrar={() => seccion.setArbolSeleccionado(null)}
    />
  );
}

function CuerpoArboles({ seccion }: { seccion: SeccionArboles }) {
  const { arboles, arbolSeleccionado } = seccion;
  if (!arboles.data) return <Cargando label="Cargando árboles…" />;
  if (arboles.data.total === 0 && seccion.hayFiltro) {
    return <VacioConFiltros mensaje="Ningún árbol coincide con los filtros" onLimpiar={seccion.limpiar} />;
  }
  // La key remonta el panel al cambiar de fila: la foto y el mapa se rearman.
  const panel = arbolSeleccionado && (
    <PanelArbolSeleccionado key={arbolSeleccionado.id} seccion={seccion} arbol={arbolSeleccionado} />
  );
  return (
    <LayoutConPanel panel={panel}>
      <TablaArboles seccion={seccion} datos={arboles.data} />
    </LayoutConPanel>
  );
}

/** Sección Árboles de la tab Datos: toolbar + filtros + tabla paginada server-side. */
export function ArbolesSection() {
  const seccion = useArbolesSection();
  const { arboles, parcelas, grupos, especies } = seccion;
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
      <DatosToolbar segmento={SEGMENTO_DATOS.arboles}>
        <ArbolesFiltros
          filtros={seccion.filtros}
          parcelas={parcelas.data ?? []}
          grupos={grupos.data ?? []}
          especies={especies.data ?? []}
          onCambiar={seccion.setFiltro}
        />
      </DatosToolbar>
      <CuerpoArboles seccion={seccion} />
    </>
  );
}
