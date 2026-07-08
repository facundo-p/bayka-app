import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Cargando, ErrorConReintento, SpeciesChecklist } from '../../components';
import {
  listarCatalogo,
  listarEspeciesConUso,
  type EspecieCatalogo,
  type EspecieConUso,
} from '../../queries/especieQueries';
import { agregarEspecie, quitarEspecie } from '../../repositories/plantationSpeciesRepository';
import { CabeceraConfig } from './CabeceraConfig';
import styles from './SeccionesConfig.module.css';

type Toggle = { speciesId: string; habilitar: boolean; orden: number };

const QUERY_ESPECIES = (id: string) => ['plantacion-especies', id] as const;

/** Set de ids habilitados a partir de las especies de la plantación. */
function idsHabilitadas(especies: EspecieConUso[]): Set<string> {
  return new Set(especies.map((especie) => especie.id));
}

/** Set de ids habilitados con árboles: no se pueden desmarcar (paridad mobile). */
function idsBloqueadas(especies: EspecieConUso[]): Set<string> {
  return new Set(especies.filter((especie) => especie.tieneArboles).map((especie) => especie.id));
}

/**
 * Mutación optimista de habilitar/quitar especie. La reordenación manual
 * (↑/↓ de la tabla vieja) ya no se expone en la web: el orden_visual se
 * asigna por orden de alta (append al final).
 */
function useToggleEspecie(plantationId: string, catalogo: EspecieCatalogo[]) {
  const queryClient = useQueryClient();
  const clave = QUERY_ESPECIES(plantationId);
  return useMutation({
    // `orden` se calcula en el call site (cantidad habilitada actual): append
    // al final, igual que la tabla vieja, sin reordenamiento manual en web.
    mutationFn: ({ speciesId, habilitar, orden }: Toggle) =>
      habilitar
        ? agregarEspecie(plantationId, speciesId, orden)
        : quitarEspecie(plantationId, speciesId),
    onMutate: async ({ speciesId, habilitar }) => {
      await queryClient.cancelQueries({ queryKey: clave });
      const previas = queryClient.getQueryData<EspecieConUso[]>(clave) ?? [];
      queryClient.setQueryData<EspecieConUso[]>(clave, aplicarToggle(previas, catalogo, speciesId, habilitar));
      return { previas };
    },
    onError: (_error, _variables, contexto) => {
      if (contexto) queryClient.setQueryData(clave, contexto.previas);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });
}

/** Aplica el toggle al cache: agrega (append) o quita la especie. */
function aplicarToggle(
  previas: EspecieConUso[],
  catalogo: EspecieCatalogo[],
  speciesId: string,
  habilitar: boolean,
): EspecieConUso[] {
  if (!habilitar) return previas.filter((especie) => especie.id !== speciesId);
  const base = catalogo.find((especie) => especie.id === speciesId);
  if (!base) return previas;
  return [...previas, { ...base, ordenVisual: previas.length, tieneArboles: false }];
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
  const [busqueda, setBusqueda] = useState('');
  const habilitadas = useMemo(() => idsHabilitadas(especies), [especies]);
  const bloqueadas = useMemo(() => idsBloqueadas(especies), [especies]);
  const toggle = useToggleEspecie(plantationId, catalogo);

  return (
    <>
      <SpeciesChecklist
        catalogo={catalogo}
        habilitadas={habilitadas}
        bloqueadas={bloqueadas}
        onToggle={(speciesId, habilitar) =>
          toggle.mutate({ speciesId, habilitar, orden: especies.length })
        }
        busqueda={busqueda}
        onBuscar={setBusqueda}
      />
      {toggle.isError && (
        <p className={styles.errorAccion} role="alert">
          No se pudo guardar el cambio de especie.
        </p>
      )}
    </>
  );
}

/** Qué especies pueden registrar los técnicos en esta plantación (checklist). */
export function EspeciesConfigSection() {
  const { id = '' } = useParams();
  const catalogo = useQuery({ queryKey: ['especies-catalogo'], queryFn: listarCatalogo });
  const especies = useQuery({
    queryKey: QUERY_ESPECIES(id),
    queryFn: () => listarEspeciesConUso(id),
  });
  const reintentar = () => void Promise.all([catalogo.refetch(), especies.refetch()]);
  const habilitadas = especies.data?.length ?? 0;

  return (
    <Card>
      <CabeceraConfig
        titulo="Especies habilitadas"
        subtitulo="Definen la botonera de registro en la app"
        chip={`${habilitadas} habilitadas`}
      />
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
