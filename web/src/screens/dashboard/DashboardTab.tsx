import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Cargando, EmptyState, ErrorConReintento } from '../../components';
import { HeroMetric } from '../../components/HeroMetric';
import { StatCard } from '../../components/StatCard';
import { PlantationMap } from '../../components/PlantationMap';
import { formatearEntero } from '../../lib/formato';
import { obtenerDashboard, type DashboardData } from '../../queries/dashboardQueries';
import { obtenerPlantacion } from '../../queries/plantationQueries';
import { listarPuntosGps, type PuntoGps } from '../../queries/mapaQueries';
import {
  listarParcelasConStats,
  type ParcelaConStats,
} from '../../queries/dataExplorerQueries';
import { asignarColoresEspecies } from './coloresEspecies';
import { SpeciesDistribution } from './SpeciesDistribution';
import { ParcelasStrip } from './ParcelasStrip';
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

/** Progreso del total hacia el objetivo; 0% si el objetivo no está definido. */
function porcentajeObjetivo(total: number, objetivo: number): number {
  return objetivo > 0 ? Math.round((total / objetivo) * 100) : 0;
}

/** Puntos de una parcela; sin selección devuelve el MISMO array (si cambia la
 *  referencia, el mapa vuelve a encuadrar aunque no haya filtrado nada). */
function filtrarPorParcela(puntos: PuntoGps[], parcelaId: string | null): PuntoGps[] {
  if (parcelaId === null) return puntos;
  return puntos.filter((punto) => punto.parcelaId === parcelaId);
}

interface ContenidoDashboardProps {
  datos: DashboardData;
  objetivoArboles: number | null;
  parcelas: ParcelaConStats[];
  puntos: PuntoGps[];
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
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  if (datos.totalArboles === 0) return <SinArboles />;
  const coloreadas = asignarColoresEspecies(datos.porEspecie);
  // Si la parcela seleccionada ya no está en la lista, el filtro se cae solo.
  const parcelaFiltro = parcelas.find((parcela) => parcela.id === seleccionada) ?? null;
  const alternar = (parcelaId: string) =>
    setSeleccionada((actual) => (actual === parcelaId ? null : parcelaId));
  return (
    <div className={styles.dashboard}>
      <FilaA datos={datos} objetivoArboles={objetivoArboles} />
      <div className={styles.filaB}>
        <PlantationMap
          puntos={filtrarPorParcela(puntos, parcelaFiltro?.id ?? null)}
          leyenda={coloreadas}
          parcelaFiltro={parcelaFiltro?.codigo}
        />
        <SpeciesDistribution especies={coloreadas} totalEspecies={datos.especiesUsadas} />
      </div>
      <ParcelasStrip
        parcelas={parcelas}
        parcelaSeleccionada={parcelaFiltro?.id ?? null}
        onSeleccionar={alternar}
      />
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
