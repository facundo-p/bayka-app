import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BuscadorEspecies, MaestroEspecies, SpeciesChecklist } from '../../components';
import { useCatalogoEspecies } from '../../hooks/useCatalogoEspecies';
import { CLAVE_QUERY } from '../../queries/clavesQuery';
import { listarEspeciesConUso } from '../../queries/especieQueries';
import { CabeceraConfig } from './CabeceraConfig';
import { CardConfig } from './CardConfig';
import { chipEspecies } from './chipsConfig';
import { ErrorAccion } from './ErrorAccion';
import { useChecklistEspecies, type DatosChecklist } from './useChecklistEspecies';
import styles from './SeccionesConfig.module.css';

const TITULO = 'Especies habilitadas';
const SUBTITULO = 'Definen la botonera de registro en la app';
const PIE =
  'Las especies con árboles registrados no se pueden desmarcar. El orden en la app es el orden de alta.';

type Checklist = ReturnType<typeof useChecklistEspecies>;

function useEspeciesDePlantacion(plantationId: string) {
  return useQuery({
    queryKey: CLAVE_QUERY.plantacionEspecies(plantationId),
    queryFn: () => listarEspeciesConUso(plantationId),
  });
}

function CabeceraEspecies({ checklist, chip }: { checklist: Checklist; chip: string }) {
  const acciones = (
    <>
      <BuscadorEspecies busqueda={checklist.busqueda} onBuscar={checklist.setBusqueda} />
      <MaestroEspecies
        estado={checklist.estado}
        deshabilitado={checklist.contexto.idsVisibles.length === 0}
        onMaestro={checklist.alternarTodas}
      />
    </>
  );
  return <CabeceraConfig titulo={TITULO} subtitulo={SUBTITULO} chip={chip} acciones={acciones} />;
}

function AvisosEspecies({ checklist }: { checklist: Checklist }) {
  return (
    <>
      {checklist.aviso && (
        <p className={styles.avisoInfo} role="status">
          {checklist.aviso}
        </p>
      )}
      <ErrorAccion mensaje={checklist.mensajeError} />
    </>
  );
}

function ContenidoEspecies(datos: DatosChecklist) {
  const checklist = useChecklistEspecies(datos);
  const chip = chipEspecies(datos.especies.length, datos.catalogo.length);
  return (
    <>
      <CabeceraEspecies checklist={checklist} chip={chip} />
      <div className={styles.cuerpoEspecies}>
        <SpeciesChecklist
          catalogo={datos.catalogo}
          habilitadas={checklist.contexto.habilitadas}
          bloqueadas={checklist.contexto.bloqueadas}
          onToggle={checklist.alternar}
          busqueda={checklist.busqueda}
        />
      </div>
      <AvisosEspecies checklist={checklist} />
      <p className={styles.pieEspecies}>{PIE}</p>
    </>
  );
}

/** Qué especies pueden registrar los técnicos en esta plantación. */
export function EspeciesConfigSection() {
  const { id = '' } = useParams();
  const catalogo = useCatalogoEspecies();
  const especies = useEspeciesDePlantacion(id);
  return (
    <CardConfig
      className={styles.cardEspecies}
      titulo={TITULO}
      subtitulo={SUBTITULO}
      consultas={[catalogo, especies]}
      mensajeError="No se pudieron cargar las especies."
    >
      {catalogo.data && especies.data && (
        <ContenidoEspecies plantationId={id} catalogo={catalogo.data} especies={especies.data} />
      )}
    </CardConfig>
  );
}
