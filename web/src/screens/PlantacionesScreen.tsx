import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  Button,
  CabeceraSeccion,
  CardTabla,
  Cargando,
  EmptyState,
  ErrorConReintento,
  PlantacionFormModal,
  Table,
  Topbar,
} from '../components';
import { useDebounce } from '../hooks/useDebounce';
import { pluralizar } from '../lib/formato';
import { CLAVE_QUERY } from '../queries/clavesQuery';
import { listarPlantaciones } from '../queries/plantationQueries';
import { COLUMNAS_PLANTACIONES } from './plantaciones/columnas';
import { useColumnasVisibles } from '../hooks/useColumnasVisibles';
import { PlantacionesToolbar } from './plantaciones/PlantacionesToolbar';
import {
  contarArboles,
  FILTRO_ESTADO,
  filtrarPlantaciones,
  ORDEN_PLANTACION,
  resumenPlantaciones,
  TEMPORADA_TODAS,
  temporadasDisponibles,
  type FiltroEstado,
  type OrdenPlantacion,
} from './plantaciones/filtros';
import { TAMANO_ICONO } from '../theme/iconos';
import styles from './plantaciones/Plantaciones.module.css';

const DEBOUNCE_BUSQUEDA_MS = 200;

const PIE_AYUDA = 'clic en una fila abre el detalle';
const PIE_NOTA = 'Las plantaciones ocultas en la app aparecen marcadas';

export function PlantacionesScreen() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>(FILTRO_ESTADO.todas);
  const [temporada, setTemporada] = useState(TEMPORADA_TODAS);
  const [orden, setOrden] = useState<OrdenPlantacion>(ORDEN_PLANTACION.arboles);
  const [crearAbierto, setCrearAbierto] = useState(false);
  const columnas = useColumnasVisibles(COLUMNAS_PLANTACIONES);
  const busquedaDemorada = useDebounce(busqueda, DEBOUNCE_BUSQUEDA_MS);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: CLAVE_QUERY.plantaciones(),
    queryFn: listarPlantaciones,
  });

  const temporadas = useMemo(() => temporadasDisponibles(data ?? []), [data]);
  const visibles = useMemo(
    () => filtrarPlantaciones(data ?? [], { busqueda: busquedaDemorada, estado, temporada, orden }),
    [data, busquedaDemorada, estado, temporada, orden],
  );

  return (
    <section className={styles.pantalla}>
      <Topbar
        densidad="compacta"
        left={
          <CabeceraSeccion
            raiz="Organización"
            titulo="Plantaciones"
            meta={data ? resumenPlantaciones(data) : undefined}
          />
        }
        right={
          <Button size="sm" onClick={() => setCrearAbierto(true)}>
            <Plus size={TAMANO_ICONO.md} aria-hidden />
            Nueva plantación
          </Button>
        }
      />
      <div className={styles.contenido}>
        <PlantacionesToolbar
          busqueda={busqueda}
          estado={estado}
          temporada={temporada}
          orden={orden}
          onBuscar={setBusqueda}
          onEstado={setEstado}
          onTemporada={setTemporada}
          onOrden={setOrden}
          temporadas={temporadas}
          plantaciones={visibles.length}
          arboles={contarArboles(visibles)}
        />
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
            <CardTabla
              pie={`${pluralizar(visibles.length, 'plantación', 'plantaciones')} · ${PIE_AYUDA}`}
              pieDerecha={PIE_NOTA}
            >
              <Table
                columns={columnas}
                rows={visibles}
                getRowKey={(plantacion) => plantacion.id}
                onRowClick={(plantacion) => void navigate(`/plantaciones/${plantacion.id}`)}
                emptyMessage="Ninguna plantación coincide con los filtros"
              />
            </CardTabla>
          ))}
      </div>
      {crearAbierto && (
        <PlantacionFormModal plantacion={null} onClose={() => setCrearAbierto(false)} />
      )}
    </section>
  );
}
