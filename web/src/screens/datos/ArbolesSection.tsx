import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Cargando,
  ErrorConReintento,
  Paginacion,
  Table,
  type TableColumn,
} from '../../components';
import { formatearFechaCorta } from '../../lib/fechas';
import { listarArboles, type ArbolDetalle, type PaginaArboles } from '../../queries/dataExplorerQueries';
import { listarCatalogo } from '../../queries/especieQueries';
import { listarPerfiles, type PerfilResumen } from '../../queries/usuarioQueries';
import { obtenerUrlFoto, tieneFotoSubida } from '../../services/fotoService';
import { ArbolesFiltros } from './ArbolesFiltros';
import { FILTROS_INICIALES, aFiltrosArboles, type FiltrosUi } from './filtrosArboles';
import { useGruposDatos, useParcelasDatos } from './useDatosQueries';
import styles from './SeccionesDatos.module.css';

/** Redondeo de coordenadas para mostrar (~1 m de precisión). */
const DECIMALES_GPS = 5;

/** Coordenadas + precisión; nada si el árbol no tiene GPS (nunca "0,0"). */
function CeldaGps({ arbol }: { arbol: ArbolDetalle }) {
  if (arbol.latitude == null || arbol.longitude == null) return null;
  return (
    <span className={styles.gps}>
      {arbol.latitude.toFixed(DECIMALES_GPS)}, {arbol.longitude.toFixed(DECIMALES_GPS)}
      {arbol.gpsAccuracy != null && (
        <span className={styles.precision}> ±{Math.round(arbol.gpsAccuracy)}m</span>
      )}
    </span>
  );
}

/** Especie del árbol; badge "N/N" si está sin identificar. */
function CeldaEspecie({ arbol }: { arbol: ArbolDetalle }) {
  if (!arbol.especieCodigo) return <Badge variant="warning">N/N</Badge>;
  return <>{`${arbol.especieCodigo} — ${arbol.especieNombre}`}</>;
}

/** Abre la foto firmada en una pestaña nueva; oculto si no hay foto subida. */
function BotonVerFoto({ fotoUrl }: { fotoUrl: string | null }) {
  const verFoto = useMutation({
    mutationFn: () => obtenerUrlFoto(fotoUrl),
    onSuccess: (url) => {
      if (url) window.open(url, '_blank', 'noopener');
    },
  });
  if (!tieneFotoSubida(fotoUrl)) return null;
  return (
    <Button variant="secondary" size="sm" loading={verFoto.isPending} onClick={() => verFoto.mutate()}>
      Ver
    </Button>
  );
}

function columnasArboles(
  codigosParcela: Map<string, string>,
  nombresUsuario: Map<string, string>,
): Array<TableColumn<ArbolDetalle>> {
  return [
    {
      key: 'subId',
      header: 'ID',
      render: (arbol) => <span className={styles.codigo}>{arbol.subId}</span>,
    },
    { key: 'especie', header: 'Especie', render: (arbol) => <CeldaEspecie arbol={arbol} /> },
    {
      key: 'parcela',
      header: 'Parcela',
      render: (arbol) => (arbol.parcelaId && codigosParcela.get(arbol.parcelaId)) || '—',
    },
    {
      key: 'grupo',
      header: 'Grupo',
      render: (arbol) => <span className={styles.codigo}>{arbol.grupoCodigo}</span>,
    },
    { key: 'posicion', header: 'Posición', align: 'right' },
    { key: 'gps', header: 'GPS', render: (arbol) => <CeldaGps arbol={arbol} /> },
    { key: 'foto', header: 'Foto', render: (arbol) => <BotonVerFoto fotoUrl={arbol.fotoUrl} /> },
    {
      key: 'createdAt',
      header: 'Registrado',
      render: (arbol) => formatearFechaCorta(arbol.createdAt),
    },
    {
      key: 'usuario',
      header: 'Usuario',
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
}: {
  datos: PaginaArboles;
  codigosParcela: Map<string, string>;
  perfiles: PerfilResumen[];
  pagina: number;
  onCambiarPagina: (pagina: number) => void;
}) {
  const nombresUsuario = new Map(perfiles.map((perfil) => [perfil.id, perfil.nombre]));
  return (
    <>
      <Table
        columns={columnasArboles(codigosParcela, nombresUsuario)}
        rows={datos.arboles}
        getRowKey={(arbol) => arbol.id}
        emptyMessage="Sin árboles para mostrar"
      />
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

/** Sección Árboles de la tab Datos: filtros + tabla paginada server-side. */
export function ArbolesSection() {
  const { id = '' } = useParams();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [pagina, setPagina] = useState(1);
  const parcelas = useParcelasDatos(id);
  const grupos = useGruposDatos(id, filtros.parcelaId);
  const especies = useQuery({ queryKey: ['especies-catalogo'], queryFn: listarCatalogo });
  const perfiles = useQuery({ queryKey: ['perfiles'], queryFn: listarPerfiles });
  const arboles = useQuery({
    queryKey: ['datos-arboles', id, filtros, pagina],
    queryFn: () => listarArboles(id, aFiltrosArboles(filtros), pagina),
  });

  /** Cambiar un filtro vuelve a la página 1; cambiar de parcela resetea el grupo. */
  const cambiarFiltro = (campo: keyof FiltrosUi, valor: string) => {
    setFiltros((previos) => ({
      ...previos,
      [campo]: valor,
      ...(campo === 'parcelaId' ? { groupId: '' } : {}),
    }));
    setPagina(1);
  };

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
      <ArbolesFiltros
        filtros={filtros}
        parcelas={parcelas.data ?? []}
        grupos={grupos.data ?? []}
        especies={especies.data ?? []}
        onCambiar={cambiarFiltro}
      />
      {arboles.isPending ? (
        <Cargando />
      ) : (
        <TablaArboles
          datos={arboles.data}
          codigosParcela={new Map((parcelas.data ?? []).map((parcela) => [parcela.id, parcela.codigo]))}
          perfiles={perfiles.data ?? []}
          pagina={pagina}
          onCambiarPagina={setPagina}
        />
      )}
    </>
  );
}
