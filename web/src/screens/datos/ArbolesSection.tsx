import { Check } from 'lucide-react';
import {
  Cargando,
  CardTabla,
  ErrorConReintento,
  LayoutConPanel,
  Paginacion,
  Table,
  type TableColumn,
} from '../../components';
import { ARBOLES_POR_PAGINA } from '../../queries/dataExplorerQueries';
import { formatearEntero } from '../../lib/formato';
import { varsCss } from '../../lib/cssVars';
import { formatearFechaCorta } from '../../lib/fechas';
import type { ArbolDetalle, PaginaArboles } from '../../queries/dataExplorerQueries';
import type { PerfilResumen } from '../../queries/usuarioQueries';
import { NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { tieneFotoSubida } from '../../services/fotoService';
import { ArbolDetallePanel } from './ArbolDetallePanel';
import { ArbolesFiltros } from './ArbolesFiltros';
import { DatosToolbar } from './DatosToolbar';
import { VacioConFiltros } from './VacioConFiltros';
import { useArbolesSection } from './useArbolesSection';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import styles from './SeccionesDatos.module.css';

/** Redondeo de coordenadas para mostrar (~1 m de precisión). */
const DECIMALES_GPS = 5;

/** Tamaño del ícono de foto subida, en px. */
const TAMANIO_ICONO_FOTO = 16;

/** Coordenadas + precisión; nada si el árbol no tiene GPS (nunca "0,0"). */
function CeldaGps({ arbol }: { arbol: ArbolDetalle }) {
  if (arbol.latitude == null || arbol.longitude == null) return '—';
  return (
    <span className={styles.gps}>
      {arbol.latitude.toFixed(DECIMALES_GPS)}, {arbol.longitude.toFixed(DECIMALES_GPS)}
      {arbol.gpsAccuracy != null && (
        <span className={styles.precision}> ±{Math.round(arbol.gpsAccuracy)}m</span>
      )}
    </span>
  );
}

/** Especie del árbol (ver `BloqueEspecie` en ArbolDetallePanel). */
function CeldaEspecie({ arbol }: { arbol: ArbolDetalle }) {
  const codigo = arbol.especieCodigo ?? 'N/N';
  const nombre = arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR;
  return (
    <span className={styles.especie}>
      <span
        className={styles.puntoEspecie}
        style={varsCss({ color: colorEspeciePorCodigo(arbol.especieCodigo) })}
      />
      {`${codigo} · ${nombre}`}
    </span>
  );
}

/** Check no interactivo cuando el árbol tiene foto subida; nada si no hay.
 *  La foto se ve abriendo el detalle de la fila. */
function CeldaFoto({ fotoUrl }: { fotoUrl: string | null }) {
  if (!tieneFotoSubida(fotoUrl)) return null;
  return (
    <span className={styles.fotoCheck} aria-label="Con foto">
      <Check size={TAMANIO_ICONO_FOTO} />
    </span>
  );
}

/** Columnas que el panel lateral repite en grande: sobran mientras está abierto,
 *  y sin sacarlas las nueve no entran en el ancho que queda. */
const COLUMNAS_EN_EL_PANEL = ['gps', 'createdAt', 'usuario'];

function columnasArboles(
  codigosParcela: Map<string, string>,
  nombresUsuario: Map<string, string>,
  conPanel: boolean,
): Array<TableColumn<ArbolDetalle>> {
  const columnas: Array<TableColumn<ArbolDetalle>> = [
    {
      key: 'subId',
      header: 'SubID',
      render: (arbol) => <span className={styles.subId}>{arbol.subId}</span>,
    },
    { key: 'especie', header: 'Especie', render: (arbol) => <CeldaEspecie arbol={arbol} /> },
    {
      key: 'parcela',
      header: 'Parcela',
      render: (arbol) =>
        arbol.parcelaId && codigosParcela.get(arbol.parcelaId) ? (
          <span className={styles.codigo}>{codigosParcela.get(arbol.parcelaId)}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'grupo',
      header: 'Grupo',
      render: (arbol) => <span className={styles.codigo}>{arbol.grupoCodigo}</span>,
    },
    {
      key: 'posicion',
      header: 'Pos.',
      align: 'center',
      render: (arbol) => <span className={styles.numero}>{arbol.posicion ?? '—'}</span>,
    },
    { key: 'gps', header: 'GPS', render: (arbol) => <CeldaGps arbol={arbol} /> },
    { key: 'foto', header: 'Foto', render: (arbol) => <CeldaFoto fotoUrl={arbol.fotoUrl} /> },
    {
      key: 'createdAt',
      header: 'Registrado',
      render: (arbol) => formatearFechaCorta(arbol.createdAt),
    },
    {
      key: 'usuario',
      header: 'Técnico',
      render: (arbol) =>
        (arbol.usuarioRegistro && nombresUsuario.get(arbol.usuarioRegistro)) || '—',
    },
  ];
  if (!conPanel) return columnas;
  return columnas.filter((columna) => !COLUMNAS_EN_EL_PANEL.includes(columna.key));
}

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
        columns={columnasArboles(codigosParcela, nombresUsuario, seleccionadoId !== undefined)}
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
