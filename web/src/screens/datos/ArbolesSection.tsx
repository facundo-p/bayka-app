import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Cargando, ErrorConReintento, Paginacion, Table, type TableColumn } from '../../components';
import { useDebounce } from '../../hooks/useDebounce';
import { formatearFechaCorta } from '../../lib/fechas';
import { formatearEntero } from '../../lib/formato';
import { listarArboles, type ArbolDetalle, type PaginaArboles } from '../../queries/dataExplorerQueries';
import { listarCatalogo } from '../../queries/especieQueries';
import { listarPerfiles, type PerfilResumen } from '../../queries/usuarioQueries';
import { NOMBRE_SIN_IDENTIFICAR } from '../../queries/especiesConstantes';
import { tieneFotoSubida } from '../../services/fotoService';
import { ArbolDetalleModal } from './ArbolDetalleModal';
import { ArbolesFiltros } from './ArbolesFiltros';
import { DatosToolbar } from './DatosToolbar';
import { ScopeChips, type ScopeChip } from './ScopeChips';
import { VacioConFiltros } from './VacioConFiltros';
import { aFiltrosArboles, type FiltrosUi } from './filtrosArboles';
import { useFiltrosDatos } from './useFiltrosDatos';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';
import { colorEspeciePorCodigo } from '../../theme/coloresEspecie';
import styles from './SeccionesDatos.module.css';

/** Redondeo de coordenadas para mostrar (~1 m de precisión). */
const DECIMALES_GPS = 5;

/** Retardo del debounce de la búsqueda por ID, en ms. */
const RETARDO_BUSQUEDA_MS = 300;

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

/** Especie del árbol: punto de color + "código · nombre" (N/N si sin identificar). */
function CeldaEspecie({ arbol }: { arbol: ArbolDetalle }) {
  const codigo = arbol.especieCodigo ?? 'N/N';
  const nombre = arbol.especieNombre ?? NOMBRE_SIN_IDENTIFICAR;
  return (
    <span className={styles.especie}>
      <span className={styles.puntoEspecie} style={{ backgroundColor: colorEspeciePorCodigo(arbol.especieCodigo) }} />
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

function columnasArboles(
  codigosParcela: Map<string, string>,
  nombresUsuario: Map<string, string>,
): Array<TableColumn<ArbolDetalle>> {
  return [
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
}

function TablaArboles({
  datos,
  codigosParcela,
  perfiles,
  pagina,
  onCambiarPagina,
  onRowClick,
}: {
  datos: PaginaArboles;
  codigosParcela: Map<string, string>;
  perfiles: PerfilResumen[];
  pagina: number;
  onCambiarPagina: (pagina: number) => void;
  onRowClick: (arbol: ArbolDetalle) => void;
}) {
  const nombresUsuario = new Map(perfiles.map((perfil) => [perfil.id, perfil.nombre]));
  return (
    <>
      <div className={styles.tablaAncha}>
        <Table
          columns={columnasArboles(codigosParcela, nombresUsuario)}
          rows={datos.arboles}
          getRowKey={(arbol) => arbol.id}
          emptyMessage="Sin árboles para mostrar"
          onRowClick={onRowClick}
        />
      </div>
      {datos.total > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={datos.totalPaginas}
          total={datos.total}
          etiqueta="árboles"
          onCambiar={onCambiarPagina}
        />
      )}
    </>
  );
}

/** Chips del scope heredado por drill-down (parcela y/o grupo). */
function useScopeChips(
  filtros: FiltrosUi,
  setFiltro: (campo: keyof FiltrosUi, valor: string) => void,
): ScopeChip[] {
  const { id = '' } = useParams();
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtros.parcelaId);
  const chips: ScopeChip[] = [];
  const parcela = parcelas.data?.find((item) => item.id === filtros.parcelaId);
  if (parcela) {
    chips.push({ etiqueta: `Parcela ${parcela.codigo}`, onQuitar: () => setFiltro('parcelaId', '') });
  }
  const grupo = grupos.data?.find((item) => item.id === filtros.groupId);
  if (grupo) {
    chips.push({ etiqueta: `Grupo ${grupo.codigo}`, onQuitar: () => setFiltro('groupId', '') });
  }
  return chips;
}

/** Sección Árboles de la tab Datos: toolbar + filtros + tabla paginada server-side. */
export function ArbolesSection() {
  const { id = '' } = useParams();
  const { filtros, setFiltro, hayFiltro, limpiar } = useFiltrosDatos();
  const [pagina, setPagina] = useState(1);
  const [arbolSeleccionado, setArbolSeleccionado] = useState<ArbolDetalle | null>(null);
  const busquedaDebounced = useDebounce(filtros.busqueda, RETARDO_BUSQUEDA_MS);
  const filtrosQuery = { ...filtros, busqueda: busquedaDebounced };

  const parcelas = useParcelasDatos(id);
  const especies = useQuery({ queryKey: ['especies-catalogo'], queryFn: listarCatalogo });
  const perfiles = useQuery({ queryKey: ['perfiles'], queryFn: listarPerfiles });
  const arboles = useQuery({
    queryKey: ['datos-arboles', id, filtrosQuery, pagina],
    queryFn: () => listarArboles(id, aFiltrosArboles(filtrosQuery), pagina),
    placeholderData: keepPreviousData,
  });
  const chips = useScopeChips(filtros, setFiltro);
  const recuento = arboles.data ? `${formatearEntero(arboles.data.total)} árboles` : undefined;
  const codigosParcela = new Map((parcelas.data ?? []).map((parcela) => [parcela.id, parcela.codigo]));
  const nombresUsuario = new Map((perfiles.data ?? []).map((perfil) => [perfil.id, perfil.nombre]));

  /** Cualquier cambio de filtro vuelve a la página 1. */
  useEffect(() => setPagina(1), [filtros.parcelaId, filtros.groupId, filtros.speciesId, filtros.gps, busquedaDebounced]);

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
      <DatosToolbar segmento="arboles" recuento={recuento}>
        <ArbolesFiltros
          filtros={filtros}
          parcelas={parcelas.data ?? []}
          especies={especies.data ?? []}
          onCambiar={setFiltro}
        />
      </DatosToolbar>
      <ScopeChips chips={chips} />
      {arboles.isPending ? (
        <Cargando label="Cargando árboles…" />
      ) : arboles.data.total === 0 && hayFiltro ? (
        <VacioConFiltros mensaje="Ningún árbol coincide con los filtros" onLimpiar={limpiar} />
      ) : (
        <TablaArboles
          datos={arboles.data}
          codigosParcela={codigosParcela}
          perfiles={perfiles.data ?? []}
          pagina={pagina}
          onCambiarPagina={setPagina}
          onRowClick={setArbolSeleccionado}
        />
      )}
      {arbolSeleccionado && (
        <ArbolDetalleModal
          arbol={arbolSeleccionado}
          parcelaCodigo={
            (arbolSeleccionado.parcelaId && codigosParcela.get(arbolSeleccionado.parcelaId)) || null
          }
          tecnicoNombre={
            (arbolSeleccionado.usuarioRegistro &&
              nombresUsuario.get(arbolSeleccionado.usuarioRegistro)) ||
            null
          }
          onClose={() => setArbolSeleccionado(null)}
        />
      )}
    </>
  );
}
