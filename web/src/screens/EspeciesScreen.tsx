import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  Button,
  CabeceraSeccion,
  CardTabla,
  Cargando,
  EmptyState,
  ErrorConReintento,
  LayoutConPanel,
  Table,
  Topbar,
} from '../components';
import { formatearEntero } from '../lib/formato';
import { useDebounce } from '../hooks/useDebounce';
import { listarCatalogoConUso, type EspecieConCatalogoUso } from '../queries/especieQueries';
import { COLUMNAS_ESPECIES } from './especies/columnas';
import { useColumnasVisibles } from '../hooks/useColumnasVisibles';
import { EspeciePanel } from './especies/EspeciePanel';
import { EspeciesToolbar } from './especies/EspeciesToolbar';
import {
  contarArboles,
  contarEnUso,
  filtrarEspecies,
  ORDEN_ESPECIE,
  USO_ESPECIE,
  type OrdenEspecie,
  type UsoEspecie,
} from './especies/filtros';
import styles from './especies/Especies.module.css';

const DEBOUNCE_BUSQUEDA_MS = 200;

const PIE_AYUDA = 'clic en una fila abre la edición en el panel lateral';
const PIE_NOTA = 'Las especies sin uso aparecen atenuadas';

/** Selección del panel: una especie a editar, o el alta (panel vacío). */
type Seleccion = { especie: EspecieConCatalogoUso | null };

/** Meta de la cabecera: tamaño del catálogo y cuántas están en uso. */
function metaCatalogo(catalogo: EspecieConCatalogoUso[]): string {
  return `Catálogo global · ${catalogo.length} especies nativas · ${contarEnUso(catalogo)} en uso`;
}

export function EspeciesScreen() {
  const [busqueda, setBusqueda] = useState('');
  const [uso, setUso] = useState<UsoEspecie>(USO_ESPECIE.todas);
  const [orden, setOrden] = useState<OrdenEspecie>(ORDEN_ESPECIE.arboles);
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null);
  const columnas = useColumnasVisibles(COLUMNAS_ESPECIES);
  const busquedaDemorada = useDebounce(busqueda, DEBOUNCE_BUSQUEDA_MS);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['especies-catalogo-uso'],
    queryFn: listarCatalogoConUso,
  });

  const visibles = useMemo(
    () => filtrarEspecies(data ?? [], { busqueda: busquedaDemorada, uso, orden }),
    [data, busquedaDemorada, uso, orden],
  );

  return (
    <section className={styles.pantalla}>
      <Topbar
        densidad="compacta"
        left={
          <CabeceraSeccion
            raiz="Organización"
            titulo="Especies"
            meta={data ? metaCatalogo(data) : undefined}
          />
        }
        right={
          <Button size="sm" onClick={() => setSeleccion({ especie: null })}>
            <Plus size={16} aria-hidden />
            Nueva especie
          </Button>
        }
      />
      <div className={styles.contenido}>
        <EspeciesToolbar
          busqueda={busqueda}
          uso={uso}
          orden={orden}
          onBuscar={setBusqueda}
          onUso={setUso}
          onOrden={setOrden}
          especies={visibles.length}
          arboles={contarArboles(visibles)}
        />
        {isPending && <Cargando />}
        {isError && !data && (
          <ErrorConReintento
            mensaje="No se pudieron cargar las especies."
            onReintentar={() => void refetch()}
          />
        )}
        {data &&
          (data.length === 0 ? (
            <EmptyState
              title="Sin especies"
              description="El catálogo de especies va a aparecer acá."
            />
          ) : (
            <LayoutConPanel
              panel={
                seleccion && (
                  <EspeciePanel
                    // Remonta el panel al cambiar de especie: los campos se
                    // reinicializan con el estado de la nueva fila.
                    key={seleccion.especie?.id ?? 'alta'}
                    especie={seleccion.especie}
                    onCerrar={() => setSeleccion(null)}
                  />
                )
              }
            >
              <CardTabla
                pie={`${formatearEntero(visibles.length)} especies · ${PIE_AYUDA}`}
                pieDerecha={PIE_NOTA}
              >
                <Table
                  columns={columnas}
                  rows={visibles}
                  getRowKey={(especie) => especie.id}
                  claveSeleccionada={seleccion?.especie?.id}
                  onRowClick={(especie) => setSeleccion({ especie })}
                  emptyMessage="No hay especies que coincidan con la búsqueda"
                />
              </CardTabla>
            </LayoutConPanel>
          ))}
      </div>
    </section>
  );
}
