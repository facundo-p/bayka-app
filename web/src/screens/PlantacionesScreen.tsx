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
  Table,
  Topbar,
  type TableColumn,
} from '../components';
import { formatearEntero } from '../lib/formato';
import { formatearFechaCorta } from '../lib/fechas';
import { listarPlantaciones, type PlantacionConStats } from '../queries/plantationQueries';
import { PlantacionesFiltros } from './plantaciones/PlantacionesFiltros';
import {
  FILTROS_PLANTACIONES_INICIALES,
  filtrarPlantaciones,
  hayFiltrosActivos,
  lugaresDisponibles,
  periodosDisponibles,
  resumenPlantaciones,
  type FiltrosPlantaciones,
} from './plantaciones/filtrosPlantaciones';
import styles from './PlantacionesScreen.module.css';

const TAMANO_ICONO = 16;

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
  { key: 'usuarios', header: 'Usuarios', align: 'center' },
  { key: 'parcelas', header: 'Parcelas', align: 'center' },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'center',
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

function TablaPlantaciones({ plantaciones }: { plantaciones: PlantacionConStats[] }) {
  const navigate = useNavigate();
  return (
    <div className={styles.tablaScroll}>
      <Table
        columns={COLUMNAS}
        rows={plantaciones}
        getRowKey={(plantacion) => plantacion.id}
        onRowClick={(plantacion) => navigate(`/plantaciones/${plantacion.id}`)}
        emptyMessage="Ninguna plantación coincide con los filtros"
      />
    </div>
  );
}

export function PlantacionesScreen() {
  const [filtros, setFiltros] = useState<FiltrosPlantaciones>(FILTROS_PLANTACIONES_INICIALES);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['plantaciones'],
    queryFn: listarPlantaciones,
  });

  const plantaciones = useMemo(() => data ?? [], [data]);
  const lugares = useMemo(() => lugaresDisponibles(plantaciones), [plantaciones]);
  const periodos = useMemo(() => periodosDisponibles(plantaciones), [plantaciones]);
  const filtradas = useMemo(
    () => filtrarPlantaciones(plantaciones, filtros),
    [plantaciones, filtros],
  );

  const filtrosActivos = hayFiltrosActivos(filtros);
  const cambiarFiltro = (campo: keyof FiltrosPlantaciones, valor: string) =>
    setFiltros((previos) => ({ ...previos, [campo]: valor }));
  const limpiarFiltros = () => setFiltros(FILTROS_PLANTACIONES_INICIALES);

  // El subtítulo se recalcula sobre el subconjunto filtrado; cuando hay filtros
  // activos se antepone "Mostrando:" para dejar claro que es la selección.
  const resumen = resumenPlantaciones(filtradas);
  const subtitulo = filtrosActivos ? `Mostrando: ${resumen}` : resumen;

  return (
    <section>
      <Topbar
        left={<span className={styles.rotulo}>Organización · Bayka</span>}
        right={<Button onClick={() => setCrearAbierto(true)}>Nueva plantación</Button>}
      />
      <div className={styles.body}>
        <h1 className={styles.titulo}>Plantaciones</h1>
        {data && <p className={styles.subtitulo}>{subtitulo}</p>}
        {data && data.length > 0 && (
          <PlantacionesFiltros
            filtros={filtros}
            lugares={lugares}
            periodos={periodos}
            mostrarLimpiar={filtrosActivos}
            onCambiar={cambiarFiltro}
            onLimpiar={limpiarFiltros}
          />
        )}
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
          ) : filtradas.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Ninguna plantación coincide con los filtros. Probá limpiarlos."
            />
          ) : (
            <TablaPlantaciones plantaciones={filtradas} />
          ))}
      </div>
      {crearAbierto && (
        <PlantacionFormModal plantacion={null} onClose={() => setCrearAbierto(false)} />
      )}
    </section>
  );
}
