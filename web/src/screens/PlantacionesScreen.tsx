import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Cargando,
  EmptyState,
  ErrorConReintento,
  EstadoPlantacionBadge,
  PageHeader,
  PlantacionFormModal,
  Table,
  type TableColumn,
} from '../components';
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

const COLUMNAS: Array<TableColumn<PlantacionConStats>> = [
  { key: 'lugar', header: 'Lugar' },
  { key: 'periodo', header: 'Período' },
  {
    key: 'estado',
    header: 'Estado',
    render: (p) => <EstadoPlantacionBadge estado={p.estado} />,
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

/** Columna de acciones: el stopPropagation evita la navegación de la fila. */
function columnaEditar(
  onEditar: (plantacion: PlantacionConStats) => void,
): TableColumn<PlantacionConStats> {
  const editar = (event: MouseEvent, plantacion: PlantacionConStats) => {
    event.stopPropagation();
    onEditar(plantacion);
  };
  return {
    key: 'acciones',
    header: '',
    align: 'right',
    render: (plantacion) => (
      <Button variant="secondary" size="sm" onClick={(event) => editar(event, plantacion)}>
        Editar
      </Button>
    ),
  };
}

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

function TablaPlantaciones({
  plantaciones,
  hayPlantaciones,
  onEditar,
}: {
  plantaciones: PlantacionConStats[];
  hayPlantaciones: boolean;
  onEditar: (plantacion: PlantacionConStats) => void;
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
      columns={[...COLUMNAS, columnaEditar(onEditar)]}
      rows={plantaciones}
      getRowKey={(plantacion) => plantacion.id}
      onRowClick={(plantacion) => navigate(`/plantaciones/${plantacion.id}`)}
      emptyMessage="No hay plantaciones con ese estado"
    />
  );
}

/** Estado del modal: null cerrado; plantacion null = crear, con valor = editar. */
type ModalForm = { plantacion: PlantacionConStats | null };

export function PlantacionesScreen() {
  const [filtro, setFiltro] = useState<FiltroEstado>('todas');
  const [modal, setModal] = useState<ModalForm | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['plantaciones'],
    queryFn: listarPlantaciones,
  });

  return (
    <section>
      <PageHeader title="Plantaciones">
        <Button onClick={() => setModal({ plantacion: null })}>Nueva plantación</Button>
      </PageHeader>
      <FiltroChips filtro={filtro} onCambiar={setFiltro} />
      {isPending && <Cargando />}
      {isError && !data && (
        <ErrorConReintento
          mensaje="No se pudieron cargar las plantaciones."
          onReintentar={() => void refetch()}
        />
      )}
      {data && (
        <TablaPlantaciones
          plantaciones={filtrarPorEstado(data, filtro)}
          hayPlantaciones={data.length > 0}
          onEditar={(plantacion) => setModal({ plantacion })}
        />
      )}
      {modal && (
        <PlantacionFormModal plantacion={modal.plantacion} onClose={() => setModal(null)} />
      )}
    </section>
  );
}
