import { Download } from 'lucide-react';
import {
  Button,
  Cargando,
  CardTabla,
  ErrorConReintento,
  LayoutConPanel,
  Paginacion,
  Table,
  type SeleccionTabla,
} from '../../components';
import { useColumnasVisibles } from '../../hooks/useColumnasVisibles';
import { useEnfocarAlMontar } from '../../hooks/useEnfocarAlMontar';
import { formatearEntero } from '../../lib/formato';
import { SEGMENTO_DATOS } from '../../lib/rutas';
import {
  ARBOLES_POR_PAGINA,
  type ArbolDetalle,
  type PaginaArboles,
} from '../../queries/dataExplorerQueries';
import { nombreArchivoFoto } from '../../services/descargas';
import { TAMANO_ICONO } from '../../theme/iconos';
import { ArbolDetallePanel } from './ArbolDetallePanel';
import { ArbolesFiltros } from './ArbolesFiltros';
import { BarraSeleccionFichas } from './BarraSeleccionFichas';
import { nombreTecnicoDe, parcelaDe } from './arbolFormato';
import { columnasArboles } from './columnas';
import { DatosToolbar } from './DatosToolbar';
import { useArbolesSection } from './useArbolesSection';
import type { SeleccionFichas } from './useSeleccionFichas';
import { VacioConFiltros } from './VacioConFiltros';

type SeccionArboles = ReturnType<typeof useArbolesSection>;

const VACIO_CON_FILTROS = 'Ningún árbol coincide con los filtros';

const TEXTO_SELECCION = {
  entrar: 'PDF',
  // Incluye el «PDF» visible: el botón no descarga, entra en el modo selección.
  entrarDescripcion: 'Elegir árboles para las fichas PDF',
  maestro: 'Seleccionar todos los árboles de esta página',
  fila: 'Seleccionar el árbol',
} as const;

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

/** Sin modo selección, la tabla no tiene columna de checkboxes. */
function seleccionDeTabla(seleccion: SeleccionFichas): SeleccionTabla<ArbolDetalle> | undefined {
  if (!seleccion.activa) return undefined;
  return {
    marcada: (arbol) => seleccion.estaMarcado(arbol.id),
    onAlternar: (arbol) => seleccion.alternar(arbol.id),
    maestro: seleccion.maestro,
    onMaestro: seleccion.alternarTodos,
    etiquetaFila: (arbol) => `${TEXTO_SELECCION.fila} ${arbol.idArbol}`,
    etiquetaMaestro: TEXTO_SELECCION.maestro,
  };
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
        seleccion={seleccionDeTabla(seccion.seleccion)}
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

interface BotonSeleccionarProps {
  seleccion: SeleccionFichas;
  /** Del total de la query y no de la página a la vista: no parpadea al paginar. */
  sinArboles: boolean;
}

function BotonSeleccionar({ seleccion, sinArboles }: BotonSeleccionarProps) {
  const ref = useEnfocarAlMontar<HTMLButtonElement>(
    seleccion.focoEnSeleccionar,
    seleccion.focoTomado,
  );
  return (
    <Button
      ref={ref}
      variant="contorno"
      size="sm"
      aria-label={TEXTO_SELECCION.entrarDescripcion}
      title={TEXTO_SELECCION.entrarDescripcion}
      disabled={sinArboles}
      onClick={seleccion.entrar}
    >
      <Download size={TAMANO_ICONO.md} aria-hidden />
      {TEXTO_SELECCION.entrar}
    </Button>
  );
}

function sinArboles({ arboles }: SeccionArboles): boolean {
  return !arboles.data || arboles.data.total === 0;
}

function ToolbarArboles({ seccion }: { seccion: SeccionArboles }) {
  return (
    <DatosToolbar
      segmento={SEGMENTO_DATOS.arboles}
      tituloFiltros="Filtros de árboles"
      filtrosActivos={seccion.filtrosActivos}
      onLimpiar={seccion.limpiar}
      // En modo selección la salida es «Cancelar», en la franja azul.
      acciones={
        !seccion.seleccion.activa && (
          <BotonSeleccionar seleccion={seccion.seleccion} sinArboles={sinArboles(seccion)} />
        )
      }
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
      {seccion.seleccion.activa && <BarraSeleccionFichas seleccion={seccion.seleccion} />}
      <CuerpoArboles seccion={seccion} />
    </>
  );
}
