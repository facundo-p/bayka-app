import { useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Cargando, EmptyState, ErrorConReintento } from '../../components';
import { PlantationMap } from '../../components/PlantationMap';
import {
  calcularDashboard,
  obtenerFuenteDashboard,
  type FuenteDashboard,
} from '../../queries/dashboardQueries';
import { usePlantacion } from '../../hooks/usePlantacion';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarPuntosGps, type PuntoGps } from '../../queries/mapaQueries';
import type { ParcelaConStats } from '../../queries/dataExplorerQueries';
import { useParcelasDatos } from '../datos/useDatosQueries';
import { asignarColoresEspecies, type EspecieColoreada } from './coloresEspecies';
import { ResumenPlantacion } from './ResumenPlantacion';
import { SpeciesDistribution } from './SpeciesDistribution';
import { ParcelasStrip } from './ParcelasStrip';
import { useFiltroParcela } from './useFiltroParcela';
import styles from './DashboardTab.module.css';

function SinArboles() {
  return (
    <EmptyState
      icon="🌱"
      title="Todavía no hay árboles registrados"
      description="Los KPIs y el mapa aparecen cuando los técnicos registran árboles desde la app."
    />
  );
}

/** Puntos de una parcela; sin selección devuelve el MISMO array (si cambia la
 *  referencia, el mapa vuelve a encuadrar aunque no haya filtrado nada). */
function filtrarPuntos(puntos: PuntoGps[], parcelaId: string | null): PuntoGps[] {
  if (parcelaId === null) return puntos;
  return puntos.filter((punto) => punto.parcelaId === parcelaId);
}

type FiltroParcela = ReturnType<typeof useFiltroParcela>;

interface ColumnaMetricasProps {
  datos: ReturnType<typeof calcularDashboard>;
  especies: EspecieColoreada[];
  objetivo: number | null;
  filtro: FiltroParcela;
}

function ColumnaMetricas({ datos, especies, objetivo, filtro }: ColumnaMetricasProps) {
  return (
    <div className={styles.columna}>
      <ResumenPlantacion datos={datos} objetivo={objetivo} alcance={filtro.alcance} />
      <SpeciesDistribution
        especies={especies}
        total={datos.totalArboles}
        totalEspecies={datos.especiesUsadas}
        parcelaFiltro={filtro.parcela?.codigo}
      />
    </div>
  );
}

interface ColumnaMapaProps {
  puntos: PuntoGps[];
  parcelas: ParcelaConStats[];
  especies: EspecieColoreada[];
  filtro: FiltroParcela;
}

function ColumnaMapa({ puntos, parcelas, especies, filtro }: ColumnaMapaProps) {
  const parcelaId = filtro.parcela?.id ?? null;
  return (
    <div className={styles.columna}>
      <PlantationMap
        puntos={filtrarPuntos(puntos, parcelaId)}
        leyenda={especies}
        parcelaFiltro={filtro.parcela?.codigo}
      />
      <ParcelasStrip
        parcelas={parcelas}
        parcelaSeleccionada={parcelaId}
        onSeleccionar={filtro.alternar}
      />
    </div>
  );
}

interface ContenidoDashboardProps {
  fuente: FuenteDashboard;
  objetivoArboles: number | null;
  parcelas: ParcelaConStats[];
  puntos: PuntoGps[];
}

function ContenidoDashboard(props: ContenidoDashboardProps) {
  const { fuente, objetivoArboles, parcelas, puntos } = props;
  const filtro = useFiltroParcela(parcelas);
  const parcelaId = filtro.parcela?.id ?? null;
  const datos = useMemo(() => calcularDashboard(fuente, parcelaId), [fuente, parcelaId]);
  // El vacío es de la plantación: una parcela sin árboles muestra ceros y la
  // salida a "Ver todos", no una pantalla sin retorno.
  if (fuente.arboles.length === 0) return <SinArboles />;
  const especies = asignarColoresEspecies(datos.porEspecie);
  return (
    <div className={styles.dashboard}>
      <ColumnaMetricas
        datos={datos}
        especies={especies}
        objetivo={objetivoArboles}
        filtro={filtro}
      />
      <ColumnaMapa puntos={puntos} parcelas={parcelas} especies={especies} filtro={filtro} />
    </div>
  );
}

/** Mapa y parcelas pueden seguir cargando con el dashboard ya listo: se rinden
 *  defensivos (puntos=[] / parcelas=[]) sin bloquear toda la pantalla. */
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
  const objetivoArboles = plantacion.data?.objetivoArboles ?? null;
  return { dashboard, objetivoArboles, parcelas: parcelas.data ?? [], puntos: mapa.data ?? [] };
}

/** Tab Dashboard del detalle de plantación: hero, KPIs, mapa y panel de especies. */
export function DashboardTab() {
  const { id = '' } = useParams();
  const { dashboard, ...contexto } = useDatosDashboard(id);
  if (dashboard.isPending) return <Cargando />;
  if (dashboard.isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudo cargar el dashboard."
        onReintentar={() => void dashboard.refetch()}
      />
    );
  }
  return <ContenidoDashboard fuente={dashboard.data} {...contexto} />;
}
