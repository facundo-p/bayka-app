import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Cargando, EmptyState, ErrorConReintento } from '../../components';
import { HeroMetric } from '../../components/HeroMetric';
import { StatCard } from '../../components/StatCard';
import { PlantationMap } from '../../components/PlantationMap';
import { formatearEntero } from '../../lib/formato';
import { obtenerDashboard, type DashboardData } from '../../queries/dashboardQueries';
import { obtenerPlantacion } from '../../queries/plantationQueries';
import { listarPuntosGps } from '../../queries/mapaQueries';
import {
  listarParcelasConStats,
  type ParcelaConStats,
} from '../../queries/dataExplorerQueries';
import { asignarColoresEspecies, mapaColorPorCodigo } from './coloresEspecies';
import { SpeciesDistribution } from './SpeciesDistribution';
import { ParcelasStrip } from './ParcelasStrip';
import styles from './DashboardTab.module.css';

/** Cantidad de parcelas destacadas en la tira (top por árboles). */
const PARCELAS_DESTACADAS = 5;

function SinArboles() {
  return (
    <EmptyState
      icon="🌱"
      title="Todavía no hay árboles registrados"
      description="Los KPIs y el mapa aparecen cuando los técnicos registran árboles desde la app."
    />
  );
}

/** Progreso del total hacia el objetivo; 0% si el objetivo no está definido. */
function porcentajeObjetivo(total: number, objetivo: number): number {
  return objetivo > 0 ? Math.round((total / objetivo) * 100) : 0;
}

/** Top parcelas por cantidad de árboles, mapeadas a la forma de la tira. */
function parcelasDestacadas(parcelas: ParcelaConStats[]) {
  return [...parcelas]
    .sort((a, b) => b.arboles - a.arboles)
    .slice(0, PARCELAS_DESTACADAS)
    .map(({ id, codigo, nombre, arboles, grupos }) => ({ id, codigo, nombre, arboles, grupos }));
}

interface ContenidoDashboardProps {
  datos: DashboardData;
  objetivoArboles: number | null;
  parcelas: ParcelaConStats[];
  puntos: import('../../queries/mapaQueries').PuntoGps[];
}

function FilaA({ datos, objetivoArboles }: Pick<ContenidoDashboardProps, 'datos' | 'objetivoArboles'>) {
  const objetivo = objetivoArboles ?? 0;
  return (
    <div className={styles.filaA}>
      <HeroMetric
        overline="Árboles registrados"
        valor={datos.totalArboles}
        objetivo={objetivo}
        porcentaje={porcentajeObjetivo(datos.totalArboles, objetivo)}
      />
      <div className={styles.stats}>
        <StatCard
          label="Con GPS"
          value={`${datos.porcentajeConGps}%`}
          bar={{ pct: datos.porcentajeConGps, color: 'var(--color-secondary)' }}
        />
        <StatCard
          label="Con foto"
          value={`${datos.porcentajeConFoto}%`}
          bar={{ pct: datos.porcentajeConFoto, color: 'var(--color-primary-accent)' }}
        />
        <StatCard
          label="N/N sin resolver"
          value={formatearEntero(datos.arbolesNN)}
          variant={datos.arbolesNN > 0 ? 'warn' : 'default'}
          hint={datos.arbolesNN > 0 ? 'requieren atención' : undefined}
        />
      </div>
    </div>
  );
}

function ContenidoDashboard({ datos, objetivoArboles, parcelas, puntos }: ContenidoDashboardProps) {
  if (datos.totalArboles === 0) return <SinArboles />;
  const coloreadas = asignarColoresEspecies(datos.porEspecie);
  const colorPorCodigo = mapaColorPorCodigo(coloreadas);
  return (
    <div className={styles.dashboard}>
      <FilaA datos={datos} objetivoArboles={objetivoArboles} />
      <div className={styles.filaB}>
        <PlantationMap puntos={puntos} colorPorCodigo={colorPorCodigo} />
        <SpeciesDistribution especies={coloreadas} totalEspecies={datos.especiesUsadas} />
      </div>
      <ParcelasStrip parcelas={parcelasDestacadas(parcelas)} />
    </div>
  );
}

/** Tab Dashboard del detalle de plantación: hero, KPIs, mapa y panel de especies. */
export function DashboardTab() {
  const { id = '' } = useParams();
  const dashboard = useQuery({ queryKey: ['dashboard', id], queryFn: () => obtenerDashboard(id) });
  // Misma key que el shell del detalle: reusa la cache y solo aporta el objetivo.
  const plantacion = useQuery({ queryKey: ['plantacion', id], queryFn: () => obtenerPlantacion(id) });
  // Mapa y parcelas pueden seguir cargando con el dashboard ya listo: se rinden
  // defensivos (puntos=[] / parcelas=[]) sin bloquear toda la pantalla.
  const mapa = useQuery({ queryKey: ['mapa', id], queryFn: () => listarPuntosGps(id) });
  // Misma key que la tab Datos: comparten cache.
  const parcelas = useQuery({ queryKey: ['datos-parcelas', id], queryFn: () => listarParcelasConStats(id) });

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
      parcelas={parcelas.data ?? []}
      puntos={mapa.data ?? []}
    />
  );
}
