import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cargando, EmptyState, ErrorConReintento } from '../../components';
import { PlantationMap } from '../../components/PlantationMap';
import {
  calcularDashboard,
  obtenerFuenteDashboard,
  type DashboardFiltrado,
  type FuenteDashboard,
} from '../../queries/dashboardQueries';
import { useColoresEspecie } from '../../hooks/useColoresEspecie';
import type { ColorEspecie } from '../../theme/coloresEspecie';
import { useIdPlantacion } from '../../hooks/useIdPlantacion';
import { usePlantacion } from '../../hooks/usePlantacion';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarPuntosGps, type PuntoGps } from '../../queries/mapaQueries';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { useParcelasDatos } from '../datos/useDatosQueries';
import {
  asignarColoresEspecies,
  codigosConArboles,
  type EspecieColoreada,
} from './coloresEspecies';
import { armarAlcance, etiquetaEspecie, filtrarPuntos, parcelasDeTira } from './filtrosDashboard';
import { ResumenPlantacion, type AlcanceMetrica } from './ResumenPlantacion';
import { SpeciesDistribution } from './SpeciesDistribution';
import { ParcelasStrip } from './ParcelasStrip';
import { useFiltrosDashboard } from './useFiltrosDashboard';
import styles from './DashboardTab.module.css';
import { ErrorBoundary } from '../../components/ErrorBoundary';

/** Un panel roto no se lleva puesto el resto del dashboard (#338). */
const MENSAJE_PANEL_ROTO = 'No se pudo mostrar este panel.';

function SinArboles() {
  return (
    <EmptyState
      icon="🌱"
      title="Todavía no hay árboles registrados"
      description="Los KPIs y el mapa aparecen cuando los técnicos registran árboles desde la app."
    />
  );
}

type Filtro = ReturnType<typeof useFiltrosDashboard>;

/** Lo que muestran los paneles con los filtros aplicados. */
interface VistaDashboard {
  datos: DashboardFiltrado;
  especies: EspecieColoreada[];
  especie?: EspecieColoreada;
  alcance?: AlcanceMetrica;
  puntos: PuntoGps[];
  parcelas: ParcelaConStats[];
}

interface ColumnaProps {
  vista: VistaDashboard;
  filtro: Filtro;
}

function ColumnaMetricas({ vista, filtro, objetivo }: ColumnaProps & { objetivo: number | null }) {
  const { datos, especies, alcance } = vista;
  return (
    <div className={styles.columna}>
      <ErrorBoundary mensaje={MENSAJE_PANEL_ROTO}>
        <ResumenPlantacion datos={datos} objetivo={objetivo} alcance={alcance} />
      </ErrorBoundary>
      <ErrorBoundary mensaje={MENSAJE_PANEL_ROTO}>
        <SpeciesDistribution
          especies={especies}
          total={datos.composicion.totalArboles}
          totalEspecies={datos.composicion.especiesUsadas}
          parcelaFiltro={filtro.parcela?.codigo}
          especieSeleccionada={filtro.filtros.especieCodigo}
          onSeleccionar={filtro.alternarEspecie}
        />
      </ErrorBoundary>
    </div>
  );
}

function ColumnaMapa({ vista, filtro }: ColumnaProps) {
  const { puntos, parcelas, especies, especie } = vista;
  return (
    <div className={styles.columna}>
      <ErrorBoundary mensaje={MENSAJE_PANEL_ROTO}>
        <PlantationMap
          puntos={puntos}
          leyenda={especies}
          parcelaFiltro={filtro.parcela?.codigo}
          especieFiltro={especie && etiquetaEspecie(especie)}
          parcelas={parcelas}
        />
      </ErrorBoundary>
      <ErrorBoundary mensaje={MENSAJE_PANEL_ROTO}>
        <ParcelasStrip
          parcelas={parcelas}
          parcelaSeleccionada={filtro.filtros.parcelaId}
          onSeleccionar={filtro.alternarParcela}
        />
      </ErrorBoundary>
    </div>
  );
}

interface ContenidoDashboardProps {
  fuente: FuenteDashboard;
  objetivoArboles: number | null;
  parcelas: ParcelaConStats[];
  puntos: PuntoGps[];
  colorDe: ColorEspecie;
}

/** Memos: con 7.600 puntos, redibujar el mapa en cada render se nota. */
function useVistaDashboard(props: ContenidoDashboardProps, filtro: Filtro): VistaDashboard {
  const { fuente, parcelas, puntos, colorDe } = props;
  const { filtros } = filtro;
  const datos = useMemo(() => calcularDashboard(fuente, filtros), [fuente, filtros]);
  const especies = useMemo(
    () => asignarColoresEspecies(datos.porEspecie, colorDe),
    [datos, colorDe],
  );
  const visibles = useMemo(() => filtrarPuntos(puntos, filtros), [puntos, filtros]);
  const tira = useMemo(
    () => parcelasDeTira(parcelas, datos.porParcela, filtros.especieCodigo),
    [parcelas, datos, filtros],
  );
  const especie = especies.find((candidata) => candidata.codigo === filtros.especieCodigo);
  const alcance = armarAlcance(filtro.parcela, especie, filtro.limpiar);
  return { datos, especies, especie, alcance, puntos: visibles, parcelas: tira };
}

function ContenidoDashboard(props: ContenidoDashboardProps) {
  const filtro = useFiltrosDashboard(props.parcelas);
  const vista = useVistaDashboard(props, filtro);
  // El vacío es de la plantación: un filtro sin árboles muestra ceros y la
  // salida a "Ver todos", no una pantalla sin retorno.
  if (props.fuente.arboles.length === 0) return <SinArboles />;
  return (
    <div className={styles.dashboard}>
      <ColumnaMetricas vista={vista} filtro={filtro} objetivo={props.objetivoArboles} />
      <ColumnaMapa vista={vista} filtro={filtro} />
    </div>
  );
}

/** Mapa y parcelas pueden seguir cargando con el dashboard ya listo: se rinden
 *  defensivos (puntos=[] / parcelas=[]) sin bloquear toda la pantalla. Los colores
 *  de especie se leen en paralelo y sí se esperan, para no repintar (#777). */
function useDatosDashboard(plantationId: string) {
  const dashboard = useQuery({
    queryKey: CLAVE_QUERY.dashboard(plantationId),
    queryFn: () => obtenerFuenteDashboard(plantationId),
  });
  const plantacion = usePlantacion(plantationId);
  const mapa = useQuery({
    queryKey: CLAVE_QUERY.mapa(plantationId),
    queryFn: () => listarPuntosGps(plantationId),
  });
  const parcelas = useParcelasDatos(plantationId);
  const colores = useColoresEspecie(plantationId, codigosConArboles(dashboard.data));
  const objetivoArboles = plantacion.data?.objetivoArboles ?? null;
  return {
    dashboard,
    colores,
    objetivoArboles,
    parcelas: parcelas.data ?? [],
    puntos: mapa.data ?? [],
  };
}

/** Tab Dashboard del detalle de plantación: hero, KPIs, mapa y panel de especies. */
export function DashboardTab() {
  const id = useIdPlantacion();
  const { dashboard, colores, ...contexto } = useDatosDashboard(id);
  if (dashboard.isPending || !colores.listo) return <Cargando />;
  if (dashboard.isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudo cargar el dashboard."
        onReintentar={() => void dashboard.refetch()}
      />
    );
  }
  return <ContenidoDashboard fuente={dashboard.data} colorDe={colores.colorDe} {...contexto} />;
}
