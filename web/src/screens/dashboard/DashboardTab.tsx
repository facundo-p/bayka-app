import { useMemo, useState } from 'react';
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
import { asignarColoresEspecies } from './coloresEspecies';
import { ResumenPlantacion, type AlcanceMetrica } from './ResumenPlantacion';
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
function filtrarPuntos(puntos: PuntoGps[], parcelaId: string | null): PuntoGps[] {
  if (parcelaId === null) return puntos;
  return puntos.filter((punto) => punto.parcelaId === parcelaId);
}

interface ContenidoDashboardProps {
  fuente: FuenteDashboard;
  objetivoArboles: number | null;
  parcelas: ParcelaConStats[];
  puntos: PuntoGps[];
}

function ContenidoDashboard({
  fuente,
  objetivoArboles,
  parcelas,
  puntos,
}: ContenidoDashboardProps) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  // Si la parcela seleccionada ya no está en la lista, el filtro se cae solo.
  const parcelaFiltro = parcelas.find((parcela) => parcela.id === seleccionada) ?? null;
  const parcelaId = parcelaFiltro?.id ?? null;
  const datos = useMemo(() => calcularDashboard(fuente, parcelaId), [fuente, parcelaId]);
  // El vacío es de la plantación: una parcela sin árboles muestra ceros y la
  // salida a "Ver todos", no una pantalla sin retorno.
  if (fuente.arboles.length === 0) return <SinArboles />;
  const coloreadas = asignarColoresEspecies(datos.porEspecie);
  const alternar = (id: string) =>
    setSeleccionada((actual) => (actual === id ? null : id));
  const alcance: AlcanceMetrica | undefined = parcelaFiltro
    ? {
        codigo: parcelaFiltro.codigo,
        nombre: parcelaFiltro.nombre,
        onVerTodos: () => setSeleccionada(null),
      }
    : undefined;
  const objetivo = objetivoArboles ?? 0;
  return (
    <div className={styles.dashboard}>
      <div className={styles.columna}>
        <ResumenPlantacion
          datos={datos}
          objetivo={objetivo}
          porcentaje={porcentajeObjetivo(datos.totalArboles, objetivo)}
          alcance={alcance}
        />
        <SpeciesDistribution
          especies={coloreadas}
          total={datos.totalArboles}
          totalEspecies={datos.especiesUsadas}
          parcelaFiltro={parcelaFiltro?.codigo}
        />
      </div>
      <div className={styles.columna}>
        <PlantationMap
          puntos={filtrarPuntos(puntos, parcelaId)}
          leyenda={coloreadas}
          parcelaFiltro={parcelaFiltro?.codigo}
        />
        <ParcelasStrip
          parcelas={parcelas}
          parcelaSeleccionada={parcelaId}
          onSeleccionar={alternar}
        />
      </div>
    </div>
  );
}

/** Tab Dashboard del detalle de plantación: hero, KPIs, mapa y panel de especies. */
export function DashboardTab() {
  const { id = '' } = useParams();
  const dashboard = useQuery({
    queryKey: CLAVE_QUERY.dashboard(id),
    queryFn: () => obtenerFuenteDashboard(id),
  });
  const plantacion = usePlantacion(id);
  // Mapa y parcelas pueden seguir cargando con el dashboard ya listo: se rinden
  // defensivos (puntos=[] / parcelas=[]) sin bloquear toda la pantalla.
  const mapa = useQuery({ queryKey: CLAVE_QUERY.mapa(id), queryFn: () => listarPuntosGps(id) });
  const parcelas = useParcelasDatos(id);

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
      fuente={dashboard.data}
      objetivoArboles={plantacion.data?.objetivoArboles ?? null}
      parcelas={parcelas.data ?? []}
      puntos={mapa.data ?? []}
    />
  );
}
