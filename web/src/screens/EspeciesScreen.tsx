import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import {
  Button,
  Cargando,
  EmptyState,
  ErrorConReintento,
  Input,
  Table,
  Topbar,
  type TableColumn,
} from '../components';
import { cx } from '../lib/classNames';
import { formatearEntero } from '../lib/formato';
import { useDebounce } from '../hooks/useDebounce';
import { colorEspeciePorCodigo } from '../theme/coloresEspecie';
import {
  listarCatalogoConUso,
  type EspecieConCatalogoUso,
} from '../queries/especieQueries';
import styles from './EspeciesScreen.module.css';

const TAMANO_ICONO = 16;
const DEBOUNCE_BUSQUEDA_MS = 200;

/** Una especie sin uso (no habilitada en ninguna plantación, sin árboles). */
function sinUso(especie: EspecieConCatalogoUso): boolean {
  return especie.plantaciones === 0 && especie.arboles === 0;
}

/** Clase del texto de una celda: atenuada si la especie no tiene uso. */
function claseSegunUso(especie: EspecieConCatalogoUso, extra?: string): string {
  return cx(extra, sinUso(especie) && styles.filaSinUso);
}

function CeldaCodigo({ especie }: { especie: EspecieConCatalogoUso }) {
  return (
    <span className={claseSegunUso(especie, styles.codigoCelda)}>
      <span
        className={styles.puntoEspecie}
        style={{ backgroundColor: colorEspeciePorCodigo(especie.codigo) }}
      />
      <span className={styles.codigo}>{especie.codigo}</span>
    </span>
  );
}

function CeldaCientifico({ especie }: { especie: EspecieConCatalogoUso }) {
  if (!especie.nombreCientifico) return <span className={claseSegunUso(especie)}>—</span>;
  return <span className={claseSegunUso(especie, styles.cientifico)}>{especie.nombreCientifico}</span>;
}

const COLUMNAS: Array<TableColumn<EspecieConCatalogoUso>> = [
  { key: 'codigo', header: 'Código', render: (especie) => <CeldaCodigo especie={especie} /> },
  {
    key: 'nombre',
    header: 'Nombre común',
    render: (especie) => <span className={claseSegunUso(especie)}>{especie.nombre}</span>,
  },
  {
    key: 'nombreCientifico',
    header: 'Nombre científico',
    render: (especie) => <CeldaCientifico especie={especie} />,
  },
  {
    key: 'plantaciones',
    header: 'Plantaciones',
    align: 'right',
    render: (especie) => (
      <span className={claseSegunUso(especie, styles.numero)}>{especie.plantaciones}</span>
    ),
  },
  {
    key: 'arboles',
    header: 'Árboles',
    align: 'right',
    render: (especie) => (
      <span className={claseSegunUso(especie, styles.arboles)}>
        {formatearEntero(especie.arboles)}
      </span>
    ),
  },
  {
    key: 'chevron',
    header: '',
    align: 'right',
    render: () => <ChevronRight className={styles.chevron} size={TAMANO_ICONO} aria-hidden />,
  },
];

/** Coincidencia case-insensitive contra nombre, código o nombre científico. */
function coincide(especie: EspecieConCatalogoUso, termino: string): boolean {
  const aguja = termino.trim().toLowerCase();
  if (!aguja) return true;
  return [especie.nombre, especie.codigo, especie.nombreCientifico ?? '']
    .some((campo) => campo.toLowerCase().includes(aguja));
}

function filtrar(
  catalogo: EspecieConCatalogoUso[],
  termino: string,
): EspecieConCatalogoUso[] {
  return catalogo.filter((especie) => coincide(especie, termino));
}

function TablaEspecies({ especies }: { especies: EspecieConCatalogoUso[] }) {
  // No hay pantalla de detalle de especie: las filas no son clickeables.
  return (
    <div className={styles.tablaScroll}>
      <Table
        columns={COLUMNAS}
        rows={especies}
        getRowKey={(especie) => especie.id}
        emptyMessage="No hay especies que coincidan con la búsqueda"
      />
    </div>
  );
}

export function EspeciesScreen() {
  const [busqueda, setBusqueda] = useState('');
  const busquedaDemorada = useDebounce(busqueda, DEBOUNCE_BUSQUEDA_MS);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['especies-catalogo-uso'],
    queryFn: listarCatalogoConUso,
  });

  const filtradas = useMemo(
    () => filtrar(data ?? [], busquedaDemorada),
    [data, busquedaDemorada],
  );

  return (
    <section>
      <Topbar
        left={<span className={styles.rotulo}>Organización · Catálogo global</span>}
        // "Nueva especie" es un placeholder: el catálogo se siembra por seed y no
        // existe un repo de creación de especies en v1. El botón no hace nada aún.
        right={<Button onClick={() => undefined}>Nueva especie</Button>}
      />
      <div className={styles.body}>
        <h1 className={styles.titulo}>Especies</h1>
        {data && (
          <p className={styles.subtitulo}>
            Catálogo global · {data.length} especies nativas
          </p>
        )}
        <div className={styles.busqueda}>
          <Input
            label="Buscar especies"
            labelOculto
            type="search"
            placeholder="Buscar por nombre, código o científico…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
        </div>
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
            <TablaEspecies especies={filtradas} />
          ))}
      </div>
    </section>
  );
}
