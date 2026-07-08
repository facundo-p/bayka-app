import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Eye, Sprout } from 'lucide-react';
import {
  Badge,
  Button,
  Cargando,
  EmptyState,
  ErrorConReintento,
  EstadoPlantacionBadge,
  PlantacionFormModal,
  SegmentedControl,
  Table,
  Topbar,
  type TableColumn,
} from '../components';
import { formatearEntero } from '../lib/formato';
import { formatearFechaCorta } from '../lib/fechas';
import { listarPlantaciones, type PlantacionConStats } from '../queries/plantationQueries';
import styles from './PlantacionesScreen.module.css';

const TAMANO_ICONO = 16;

type FiltroEstado = 'todas' | 'activa' | 'finalizada';

/** Conteos por estado para los segmentos del filtro. */
type Conteos = { todas: number; activa: number; finalizada: number };

function CeldaLugar({ lugar }: { lugar: string }) {
  return (
    <div className={styles.lugar}>
      <span className={styles.iconoLugar}>
        <Sprout size={TAMANO_ICONO} />
      </span>
      <span className={styles.lugarTexto}>{lugar}</span>
    </div>
  );
}

function CeldaVisible({ visible }: { visible: boolean }) {
  if (!visible) return <Badge variant="neutral">Oculta</Badge>;
  return (
    <span className={styles.visibleSi}>
      <Eye size={TAMANO_ICONO} />
      Sí
    </span>
  );
}

const COLUMNAS: Array<TableColumn<PlantacionConStats>> = [
  { key: 'lugar', header: 'Lugar', render: (p) => <CeldaLugar lugar={p.lugar} /> },
  { key: 'periodo', header: 'Período' },
  { key: 'estado', header: 'Estado', render: (p) => <EstadoPlantacionBadge estado={p.estado} /> },
  { key: 'visibleInApp', header: 'Visible', render: (p) => <CeldaVisible visible={p.visibleInApp} /> },
  { key: 'usuarios', header: 'Usuarios', align: 'right' },
  { key: 'parcelas', header: 'Parcelas', align: 'right' },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'right',
    render: (p) => <span className={styles.arboles}>{formatearEntero(p.arboles)}</span>,
  },
  { key: 'createdAt', header: 'Creada', render: (p) => formatearFechaCorta(p.createdAt) },
  {
    key: 'chevron',
    header: '',
    align: 'right',
    render: () => <ChevronRight className={styles.chevron} size={TAMANO_ICONO} aria-hidden />,
  },
];

function filtrarPorEstado(
  plantaciones: PlantacionConStats[],
  filtro: FiltroEstado,
): PlantacionConStats[] {
  if (filtro === 'todas') return plantaciones;
  return plantaciones.filter((plantacion) => plantacion.estado === filtro);
}

/** Conteos por estado a partir de la lista completa. */
function contarPorEstado(plantaciones: PlantacionConStats[]): Conteos {
  return {
    todas: plantaciones.length,
    activa: plantaciones.filter((plantacion) => plantacion.estado === 'activa').length,
    finalizada: plantaciones.filter((plantacion) => plantacion.estado === 'finalizada').length,
  };
}

/** Subtítulo: N plantaciones · M temporadas distintas · TOTAL árboles. */
function calcularSubtitulo(plantaciones: PlantacionConStats[]): string {
  const temporadas = new Set(plantaciones.map((plantacion) => plantacion.periodo)).size;
  const totalArboles = plantaciones.reduce((suma, plantacion) => suma + plantacion.arboles, 0);
  return `${plantaciones.length} plantaciones · ${temporadas} temporadas · ${formatearEntero(totalArboles)} árboles registrados`;
}

function opcionesFiltro(conteos: Conteos): Array<{ value: FiltroEstado; label: string }> {
  return [
    { value: 'todas', label: `Todas ${conteos.todas}` },
    { value: 'activa', label: `Activas ${conteos.activa}` },
    { value: 'finalizada', label: `Finalizadas ${conteos.finalizada}` },
  ];
}

function TablaPlantaciones({ plantaciones }: { plantaciones: PlantacionConStats[] }) {
  const navigate = useNavigate();
  return (
    <div className={styles.tablaScroll}>
      <Table
        columns={COLUMNAS}
        rows={plantaciones}
        getRowKey={(plantacion) => plantacion.id}
        onRowClick={(plantacion) => navigate(`/plantaciones/${plantacion.id}`)}
        emptyMessage="No hay plantaciones con ese estado"
      />
    </div>
  );
}

export function PlantacionesScreen() {
  const [filtro, setFiltro] = useState<FiltroEstado>('todas');
  const [crearAbierto, setCrearAbierto] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['plantaciones'],
    queryFn: listarPlantaciones,
  });

  const conteos = useMemo(() => contarPorEstado(data ?? []), [data]);

  return (
    <section>
      <Topbar
        left={<span className={styles.rotulo}>Organización · Bayka</span>}
        right={<Button onClick={() => setCrearAbierto(true)}>Nueva plantación</Button>}
      />
      <div className={styles.body}>
        <h1 className={styles.titulo}>Plantaciones</h1>
        {data && <p className={styles.subtitulo}>{calcularSubtitulo(data)}</p>}
        <div className={styles.filtros}>
          <SegmentedControl
            aria-label="Filtrar por estado"
            options={opcionesFiltro(conteos)}
            value={filtro}
            onChange={setFiltro}
          />
        </div>
        {isPending && <Cargando />}
        {isError && !data && (
          <ErrorConReintento
            mensaje="No se pudieron cargar las plantaciones."
            onReintentar={() => void refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState
              title="Sin plantaciones"
              description="Las plantaciones de tu organización van a aparecer acá."
            />
          ) : (
            <TablaPlantaciones plantaciones={filtrarPorEstado(data, filtro)} />
          ))}
      </div>
      {crearAbierto && (
        <PlantacionFormModal plantacion={null} onClose={() => setCrearAbierto(false)} />
      )}
    </section>
  );
}
