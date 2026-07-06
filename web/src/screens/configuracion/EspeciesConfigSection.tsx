import { useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Cargando,
  EmptyState,
  ErrorConReintento,
  Modal,
  Select,
  Table,
  type TableColumn,
} from '../../components';
import {
  listarCatalogo,
  listarEspeciesConUso,
  type EspecieCatalogo,
  type EspecieConUso,
} from '../../queries/especieQueries';
import {
  agregarEspecie,
  moverEspecie,
  quitarEspecie,
  type OrdenEspecie,
} from '../../repositories/plantationSpeciesRepository';
import styles from './SeccionesConfig.module.css';

/** Paridad con mobile (hasTreesForSpecies): con árboles no se puede quitar. */
const TITULO_QUITAR_BLOQUEADO =
  'No se puede quitar: la especie tiene árboles registrados en esta plantación';

type Direccion = -1 | 1;
type MoverEspecie = (indice: number, direccion: Direccion) => void;

function useInvalidarEspecies(plantationId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ['plantacion-especies', plantationId] });
}

/** Especies del catálogo que todavía no están habilitadas. */
function catalogoDisponible(
  catalogo: EspecieCatalogo[],
  habilitadas: EspecieConUso[],
): EspecieCatalogo[] {
  const idsHabilitadas = new Set(habilitadas.map((especie) => especie.id));
  return catalogo.filter((especie) => !idsHabilitadas.has(especie.id));
}

/** La especie nueva va al final: máximo orden_visual + 1 (0 si no hay). */
function ordenSiguiente(especies: EspecieConUso[]): number {
  return especies.reduce((maximo, especie) => Math.max(maximo, especie.ordenVisual), -1) + 1;
}

function aOrden(especie: EspecieConUso): OrdenEspecie {
  return { speciesId: especie.id, ordenVisual: especie.ordenVisual };
}

function AccionesEspecie({
  especie,
  indice,
  total,
  moviendo,
  onMover,
  onQuitar,
}: {
  especie: EspecieConUso;
  indice: number;
  total: number;
  moviendo: boolean;
  onMover: MoverEspecie;
  onQuitar: (especie: EspecieConUso) => void;
}) {
  return (
    <div className={styles.accionesCelda}>
      <Button
        variant="secondary"
        size="sm"
        aria-label={`Subir ${especie.nombre}`}
        disabled={moviendo || indice === 0}
        onClick={() => onMover(indice, -1)}
      >
        ↑
      </Button>
      <Button
        variant="secondary"
        size="sm"
        aria-label={`Bajar ${especie.nombre}`}
        disabled={moviendo || indice === total - 1}
        onClick={() => onMover(indice, 1)}
      >
        ↓
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={especie.tieneArboles}
        title={especie.tieneArboles ? TITULO_QUITAR_BLOQUEADO : undefined}
        onClick={() => onQuitar(especie)}
      >
        Quitar
      </Button>
    </div>
  );
}

function columnasEspecies(
  especies: EspecieConUso[],
  moviendo: boolean,
  onMover: MoverEspecie,
  onQuitar: (especie: EspecieConUso) => void,
): Array<TableColumn<EspecieConUso>> {
  return [
    {
      key: 'codigo',
      header: 'Código',
      render: (especie) => <span className={styles.codigo}>{especie.codigo}</span>,
    },
    { key: 'nombre', header: 'Nombre' },
    {
      key: 'nombreCientifico',
      header: 'Nombre científico',
      render: (especie) => (
        <span className={styles.cientifico}>{especie.nombreCientifico ?? '—'}</span>
      ),
    },
    {
      key: 'acciones',
      header: '',
      align: 'right',
      render: (especie) => (
        <AccionesEspecie
          especie={especie}
          indice={especies.findIndex((candidata) => candidata.id === especie.id)}
          total={especies.length}
          moviendo={moviendo}
          onMover={onMover}
          onQuitar={onQuitar}
        />
      ),
    },
  ];
}

function FormAgregar({
  plantationId,
  disponibles,
  orden,
}: {
  plantationId: string;
  disponibles: EspecieCatalogo[];
  orden: number;
}) {
  const [speciesId, setSpeciesId] = useState('');
  const invalidar = useInvalidarEspecies(plantationId);
  const mutacion = useMutation({
    mutationFn: () => agregarEspecie(plantationId, speciesId, orden),
    onSuccess: async () => {
      setSpeciesId('');
      await invalidar();
    },
  });

  return (
    <div className={styles.formAlta}>
      <div className={styles.fila}>
        <Select
          label="Especie"
          value={speciesId}
          onChange={(event) => setSpeciesId(event.target.value)}
        >
          <option value="">Elegí una especie</option>
          {disponibles.map((especie) => (
            <option key={especie.id} value={especie.id}>
              {`${especie.codigo} — ${especie.nombre}`}
            </option>
          ))}
        </Select>
        <Button
          onClick={() => mutacion.mutate()}
          disabled={!speciesId}
          loading={mutacion.isPending}
          className={styles.botonFila}
        >
          Agregar
        </Button>
      </div>
      {mutacion.isError && (
        <p className={styles.errorAccion} role="alert">
          No se pudo agregar la especie.
        </p>
      )}
    </div>
  );
}

function ModalQuitarEspecie({
  plantationId,
  especie,
  onCerrar,
}: {
  plantationId: string;
  especie: EspecieConUso;
  onCerrar: () => void;
}) {
  const invalidar = useInvalidarEspecies(plantationId);
  const mutacion = useMutation({
    mutationFn: () => quitarEspecie(plantationId, especie.id),
    onSuccess: async () => {
      await invalidar();
      onCerrar();
    },
  });

  return (
    <Modal open title="Quitar especie" onClose={onCerrar}>
      <p className={styles.textoConfirmacion}>
        {especie.nombre} dejará de estar disponible para registrar árboles en esta plantación.
      </p>
      {mutacion.isError && (
        <p className={styles.errorAccion} role="alert">
          No se pudo quitar la especie.
        </p>
      )}
      <div className={styles.acciones}>
        <Button variant="secondary" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button variant="danger" loading={mutacion.isPending} onClick={() => mutacion.mutate()}>
          Quitar
        </Button>
      </div>
    </Modal>
  );
}

function ContenidoEspecies({
  plantationId,
  catalogo,
  especies,
}: {
  plantationId: string;
  catalogo: EspecieCatalogo[];
  especies: EspecieConUso[];
}) {
  const [aQuitar, setAQuitar] = useState<EspecieConUso | null>(null);
  const invalidar = useInvalidarEspecies(plantationId);
  const mover = useMutation({
    mutationFn: (movimiento: { especie: EspecieConUso; vecina: EspecieConUso }) =>
      moverEspecie(plantationId, aOrden(movimiento.especie), aOrden(movimiento.vecina)),
    onSuccess: invalidar,
  });
  const onMover: MoverEspecie = (indice, direccion) => {
    const vecina = especies[indice + direccion];
    if (vecina) mover.mutate({ especie: especies[indice], vecina });
  };

  return (
    <>
      {especies.length === 0 ? (
        <EmptyState
          title="Sin especies habilitadas: los técnicos no pueden registrar árboles"
          description="Agregá la primera especie con el selector de abajo."
        />
      ) : (
        <Table
          columns={columnasEspecies(especies, mover.isPending, onMover, setAQuitar)}
          rows={especies}
          getRowKey={(especie) => especie.id}
        />
      )}
      {mover.isError && (
        <p className={styles.errorAccion} role="alert">
          No se pudo reordenar la especie.
        </p>
      )}
      <FormAgregar
        plantationId={plantationId}
        disponibles={catalogoDisponible(catalogo, especies)}
        orden={ordenSiguiente(especies)}
      />
      {aQuitar && (
        <ModalQuitarEspecie
          plantationId={plantationId}
          especie={aQuitar}
          onCerrar={() => setAQuitar(null)}
        />
      )}
    </>
  );
}

/** Qué especies pueden registrar los técnicos en esta plantación y en qué orden. */
export function EspeciesConfigSection() {
  const { id = '' } = useParams();
  const catalogo = useQuery({ queryKey: ['especies-catalogo'], queryFn: listarCatalogo });
  const especies = useQuery({
    queryKey: ['plantacion-especies', id],
    queryFn: () => listarEspeciesConUso(id),
  });
  const reintentar = () => void Promise.all([catalogo.refetch(), especies.refetch()]);

  return (
    <Card title="Especies habilitadas">
      {(catalogo.isPending || especies.isPending) && <Cargando />}
      {(catalogo.isError || especies.isError) && (
        <ErrorConReintento mensaje="No se pudieron cargar las especies." onReintentar={reintentar} />
      )}
      {catalogo.data && especies.data && (
        <ContenidoEspecies plantationId={id} catalogo={catalogo.data} especies={especies.data} />
      )}
    </Card>
  );
}
