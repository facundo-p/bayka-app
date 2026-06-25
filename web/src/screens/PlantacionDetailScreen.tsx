import { Link, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  Breadcrumb,
  Button,
  Cargando,
  EmptyState,
  ErrorConReintento,
  EstadoPlantacionBadge,
  TabNav,
  Topbar,
  type TabItem,
} from '../components';
import { formatearFechaCorta } from '../lib/fechas';
import { obtenerPlantacion, type Plantacion } from '../queries/plantationQueries';
import styles from './PlantacionDetailScreen.module.css';

const TAMANO_ICONO = 16;

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

/** Línea de metadatos: período · superficie (si hay) · fecha de creación. */
function lineaMeta(plantacion: Plantacion): string {
  const partes = [plantacion.periodo];
  if (plantacion.superficieHa != null) partes.push(`${plantacion.superficieHa} ha`);
  partes.push(`Creada ${formatearFechaCorta(plantacion.createdAt)}`);
  return partes.join(' · ');
}

/** Acciones de la topbar: aún sin backend (placeholders no-op). */
function AccionesDetalle() {
  return (
    <>
      <Button variant="secondary" onClick={() => {}}>
        Exportar
      </Button>
      <Button variant="primary" onClick={() => {}}>
        <Plus size={TAMANO_ICONO} />
        Generar IDs
      </Button>
    </>
  );
}

function BloqueTitulo({ plantacion }: { plantacion: Plantacion }) {
  return (
    <div className={styles.titulo}>
      <div className={styles.estadoFila}>
        <EstadoPlantacionBadge estado={plantacion.estado} />
      </div>
      <h1 className={styles.lugar}>{plantacion.lugar}</h1>
      <p className={styles.meta}>{lineaMeta(plantacion)}</p>
    </div>
  );
}

/** Shell del detalle: topbar + título + tabs; cada tab se renderiza en el Outlet. */
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
      <Topbar
        left={
          <Breadcrumb
            items={[{ label: 'Plantaciones', to: '/plantaciones' }, { label: data.lugar }]}
          />
        }
        right={<AccionesDetalle />}
      />
      <BloqueTitulo plantacion={data} />
      <div className={styles.tabs}>
        <TabNav label="Secciones de la plantación" tabs={tabsDePlantacion(data.id)} />
      </div>
      <div className={styles.contenido}>
        <Outlet />
      </div>
    </section>
  );
}
