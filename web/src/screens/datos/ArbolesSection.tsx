import {
  Cargando,
  CardTabla,
  ErrorConReintento,
  LayoutConPanel,
  Paginacion,
  Table,
} from '../../components';
import { ARBOLES_POR_PAGINA } from '../../queries/dataExplorerQueries';
import { formatearEntero } from '../../lib/formato';
import type { ArbolDetalle, PaginaArboles } from '../../queries/dataExplorerQueries';
import type { PerfilResumen } from '../../queries/usuarioQueries';
import { ArbolDetallePanel } from './ArbolDetallePanel';
import { ArbolesFiltros } from './ArbolesFiltros';
import { DatosToolbar } from './DatosToolbar';
import { VacioConFiltros } from './VacioConFiltros';
import { useArbolesSection } from './useArbolesSection';
import { columnasArboles } from './columnas';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';

/** Rango visible de la página actual, ej. "Mostrando 1–50 de 934". */
function rangoVisible(pagina: number, total: number): string {
  const desde = (pagina - 1) * ARBOLES_POR_PAGINA + 1;
  const hasta = Math.min(pagina * ARBOLES_POR_PAGINA, total);
  return `Mostrando ${formatearEntero(desde)}–${formatearEntero(hasta)} de ${formatearEntero(total)}`;
}

function TablaArboles({
  datos,
  codigosParcela,
  perfiles,
  pagina,
  onCambiarPagina,
  onRowClick,
  seleccionadoId,
}: {
  datos: PaginaArboles;
  codigosParcela: Map<string, string>;
  perfiles: PerfilResumen[];
  pagina: number;
  onCambiarPagina: (pagina: number) => void;
  onRowClick: (arbol: ArbolDetalle) => void;
  seleccionadoId: string | undefined;
}) {
  const nombresUsuario = new Map(perfiles.map((perfil) => [perfil.id, perfil.nombre]));
  const columnas = useColumnasVisibles(
    columnasArboles(codigosParcela, nombresUsuario),
    seleccionadoId !== undefined,
  );
  const hayArboles = datos.total > 0;
  return (
    <CardTabla
      pie={
        hayArboles
          ? `${rangoVisible(pagina, datos.total)} · clic en una fila abre el detalle al costado`
          : undefined
      }
      acciones={
        hayArboles && (
          <Paginacion
            pagina={pagina}
            totalPaginas={datos.totalPaginas}
            onCambiar={onCambiarPagina}
          />
        )
      }
    >
      <Table
        columns={columnas}
        rows={datos.arboles}
        getRowKey={(arbol) => arbol.id}
        claveSeleccionada={seleccionadoId}
        emptyMessage="Sin árboles para mostrar"
        onRowClick={onRowClick}
      />
    </CardTabla>
  );
}

/** Sección Árboles de la tab Datos: toolbar + filtros + tabla paginada server-side. */
export function ArbolesSection() {
  const {
    filtros,
    setFiltro,
    hayFiltro,
    limpiar,
    parcelas,
    grupos,
    especies,
    perfiles,
    arboles,
    codigosParcela,
    nombresUsuario,
    pagina,
    setPagina,
    arbolSeleccionado,
    setArbolSeleccionado,
  } = useArbolesSection();

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
      <DatosToolbar segmento="arboles">
        <ArbolesFiltros
          filtros={filtros}
          parcelas={parcelas.data ?? []}
          grupos={grupos.data ?? []}
          especies={especies.data ?? []}
          onCambiar={setFiltro}
        />
      </DatosToolbar>
      {arboles.isPending ? (
        <Cargando label="Cargando árboles…" />
      ) : arboles.data.total === 0 && hayFiltro ? (
        <VacioConFiltros mensaje="Ningún árbol coincide con los filtros" onLimpiar={limpiar} />
      ) : (
        <LayoutConPanel
          panel={
            arbolSeleccionado && (
              <ArbolDetallePanel
                // Remonta el panel al cambiar de fila: la foto y el mapa se
                // rearman con el árbol nuevo.
                key={arbolSeleccionado.id}
                arbol={arbolSeleccionado}
                parcelaCodigo={
                  (arbolSeleccionado.parcelaId &&
                    codigosParcela.get(arbolSeleccionado.parcelaId)) ||
                  null
                }
                tecnicoNombre={
                  (arbolSeleccionado.usuarioRegistro &&
                    nombresUsuario.get(arbolSeleccionado.usuarioRegistro)) ||
                  null
                }
                onCerrar={() => setArbolSeleccionado(null)}
              />
            )
          }
        >
          <TablaArboles
            datos={arboles.data}
            codigosParcela={codigosParcela}
            perfiles={perfiles.data ?? []}
            pagina={pagina}
            onCambiarPagina={setPagina}
            onRowClick={setArbolSeleccionado}
            seleccionadoId={arbolSeleccionado?.id}
          />
        </LayoutConPanel>
      )}
    </>
  );
}
