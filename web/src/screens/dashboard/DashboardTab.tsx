import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Cargando, EmptyState, ErrorConReintento } from '../../components';
import { obtenerDashboard, type DashboardData } from '../../queries/dashboardQueries';
import { obtenerPlantacion } from '../../queries/plantationQueries';
import { GraficoBarrasParcelas } from './GraficoBarrasParcelas';
import { GraficoLineaMensual } from './GraficoLineaMensual';
import { GraficoTortaEspecies } from './GraficoTortaEspecies';
import { KpiCards } from './KpiCards';
import styles from './DashboardTab.module.css';

function SinArboles() {
  return (
    <EmptyState
      icon="🌱"
      title="Todavía no hay árboles registrados"
      description="Los KPIs y gráficos aparecen cuando los técnicos registran árboles desde la app."
    />
  );
}

interface ContenidoDashboardProps {
  datos: DashboardData;
  objetivoArboles: number | null;
}

function ContenidoDashboard({ datos, objetivoArboles }: ContenidoDashboardProps) {
  if (datos.totalArboles === 0) return <SinArboles />;
  return (
    <div className={styles.dashboard}>
      <KpiCards datos={datos} objetivoArboles={objetivoArboles} />
      <div className={styles.graficos}>
        <GraficoTortaEspecies distribucion={datos.porEspecie} />
        <GraficoBarrasParcelas distribucion={datos.porParcela} />
        <GraficoLineaMensual registros={datos.porMes} />
      </div>
    </div>
  );
}

/** Tab Dashboard del detalle de plantación: KPIs y gráficos. */
export function DashboardTab() {
  const { id = '' } = useParams();
  const dashboard = useQuery({ queryKey: ['dashboard', id], queryFn: () => obtenerDashboard(id) });
  // Misma key que el shell del detalle: reusa la cache y solo aporta el objetivo.
  const plantacion = useQuery({ queryKey: ['plantacion', id], queryFn: () => obtenerPlantacion(id) });

  if (dashboard.isPending) return <Cargando />;
  if (dashboard.isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudo cargar el dashboard."
        onReintentar={() => void dashboard.refetch()}
      />
    );
  }
  return (
    <ContenidoDashboard
      datos={dashboard.data}
      objetivoArboles={plantacion.data?.objetivoArboles ?? null}
    />
  );
}
