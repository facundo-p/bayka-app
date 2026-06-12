import { Link, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Cargando,
  EmptyState,
  ErrorConReintento,
  EstadoPlantacionBadge,
  PageHeader,
  TabNav,
  type TabItem,
} from '../components';
import { obtenerPlantacion, type Plantacion } from '../queries/plantationQueries';
import styles from './PlantacionDetailScreen.module.css';

function tabsDePlantacion(id: string): TabItem[] {
  return [
    { to: `/plantaciones/${id}`, label: 'Dashboard', end: true },
    { to: `/plantaciones/${id}/datos`, label: 'Datos' },
    { to: `/plantaciones/${id}/configuracion`, label: 'Configuración' },
  ];
}

function VolverAlListado() {
  return (
    <Link to="/plantaciones" className={styles.volver}>
      ← Volver a plantaciones
    </Link>
  );
}

function PlantacionNoEncontrada() {
  return (
    <EmptyState
      title="Plantación no encontrada"
      description="El enlace puede estar vencido o la plantación fue eliminada."
    >
      <VolverAlListado />
    </EmptyState>
  );
}

function EncabezadoDetalle({ plantacion }: { plantacion: Plantacion }) {
  return (
    <PageHeader title={`${plantacion.lugar} — ${plantacion.periodo}`}>
      <EstadoPlantacionBadge estado={plantacion.estado} />
      {!plantacion.visibleInApp && <Badge variant="neutral">Oculta en app</Badge>}
    </PageHeader>
  );
}

/** Shell del detalle: encabezado + tabs; cada tab se renderiza en el Outlet. */
export function PlantacionDetailScreen() {
  const { id = '' } = useParams();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['plantacion', id],
    queryFn: () => obtenerPlantacion(id),
  });

  if (isPending) return <Cargando />;
  if (isError) {
    return (
      <ErrorConReintento
        mensaje="No se pudo cargar la plantación."
        onReintentar={() => void refetch()}
      />
    );
  }
  if (!data) return <PlantacionNoEncontrada />;
  return (
    <section>
      <VolverAlListado />
      <EncabezadoDetalle plantacion={data} />
      <TabNav label="Secciones de la plantación" tabs={tabsDePlantacion(data.id)} />
      <Outlet />
    </section>
  );
}
