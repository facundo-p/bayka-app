import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, EmptyState, PageHeader, Spinner, Table, type TableColumn } from '../components';
import { cx } from '../lib/classNames';
import { formatearFechaCorta } from '../lib/fechas';
import { listarPlantaciones, type PlantacionConStats } from '../queries/plantationQueries';
import styles from './PlantacionesScreen.module.css';

type FiltroEstado = 'todas' | 'activa' | 'finalizada';

const FILTROS: Array<{ valor: FiltroEstado; etiqueta: string }> = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'activa', etiqueta: 'Activas' },
  { valor: 'finalizada', etiqueta: 'Finalizadas' },
];

const ETIQUETA_ESTADO: Record<PlantacionConStats['estado'], string> = {
  activa: 'Activa',
  finalizada: 'Finalizada',
};

const COLUMNAS: Array<TableColumn<PlantacionConStats>> = [
  { key: 'lugar', header: 'Lugar' },
  { key: 'periodo', header: 'Período' },
  {
    key: 'estado',
    header: 'Estado',
    render: (p) => <Badge variant={p.estado}>{ETIQUETA_ESTADO[p.estado]}</Badge>,
  },
  {
    key: 'visibleInApp',
    header: 'Visible en app',
    render: (p) => (p.visibleInApp ? null : <Badge variant="neutral">Oculta</Badge>),
  },
  { key: 'usuarios', header: 'Usuarios', align: 'right' },
  { key: 'parcelas', header: 'Parcelas', align: 'right' },
  { key: 'arboles', header: 'Árboles', align: 'right' },
  { key: 'createdAt', header: 'Creada', render: (p) => formatearFechaCorta(p.createdAt) },
];

function filtrarPorEstado(
  plantaciones: PlantacionConStats[],
  filtro: FiltroEstado,
): PlantacionConStats[] {
  if (filtro === 'todas') return plantaciones;
  return plantaciones.filter((plantacion) => plantacion.estado === filtro);
}

function FiltroChips({
  filtro,
  onCambiar,
}: {
  filtro: FiltroEstado;
  onCambiar: (filtro: FiltroEstado) => void;
}) {
  return (
    <div className={styles.filtros} role="group" aria-label="Filtrar por estado">
      {FILTROS.map(({ valor, etiqueta }) => (
        <button
          key={valor}
          type="button"
          className={cx(styles.chip, filtro === valor && styles.chipActivo)}
          aria-pressed={filtro === valor}
          onClick={() => onCambiar(valor)}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  );
}

function ErrorConReintento({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorTexto}>No se pudieron cargar las plantaciones.</p>
      <Button variant="secondary" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}

function TablaPlantaciones({
  plantaciones,
  hayPlantaciones,
}: {
  plantaciones: PlantacionConStats[];
  hayPlantaciones: boolean;
}) {
  const navigate = useNavigate();
  if (!hayPlantaciones) {
    return (
      <EmptyState
        title="Sin plantaciones"
        description="Las plantaciones de tu organización van a aparecer acá."
      />
    );
  }
  return (
    <Table
      columns={COLUMNAS}
      rows={plantaciones}
      getRowKey={(plantacion) => plantacion.id}
      onRowClick={(plantacion) => navigate(`/plantaciones/${plantacion.id}`)}
      emptyMessage="No hay plantaciones con ese estado"
    />
  );
}

export function PlantacionesScreen() {
  const [filtro, setFiltro] = useState<FiltroEstado>('todas');
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['plantaciones'],
    queryFn: listarPlantaciones,
  });

  return (
    <section>
      <PageHeader title="Plantaciones" />
      <FiltroChips filtro={filtro} onCambiar={setFiltro} />
      {isPending && (
        <div className={styles.cargando}>
          <Spinner />
        </div>
      )}
      {isError && !data && <ErrorConReintento onReintentar={() => void refetch()} />}
      {data && (
        <TablaPlantaciones
          plantaciones={filtrarPorEstado(data, filtro)}
          hayPlantaciones={data.length > 0}
        />
      )}
    </section>
  );
}
