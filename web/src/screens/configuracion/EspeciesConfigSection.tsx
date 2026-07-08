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
import {
  agregarEspecie,
  quitarEspecie,
  sincronizarEspecies,
} from '../../repositories/plantationSpeciesRepository';
import {
  accionDesdeEstado,
  avisoBloqueadas,
  estadoMaestro,
  filtrarCatalogo,
  planificarAccionMasiva,
} from '../../lib/speciesChecklistSelection';
import { CabeceraConfig } from './CabeceraConfig';
import styles from './SeccionesConfig.module.css';

type Toggle = { speciesId: string; habilitar: boolean; orden: number };
type Sincronizacion = { idsHabilitar: string[]; idsQuitar: string[]; ordenInicial: number };

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

/**
 * Mutación optimista de la acción masiva (marcar/desmarcar todas). Aplica el
 * batch de altas/bajas de una sola vez, con rollback e invalidación igual que
 * el toggle individual. La decisión de qué agregar/quitar la calcula el pure
 * helper `speciesChecklistSelection`; acá solo se ejecuta y se cachea.
 */
function useSincronizarEspecies(plantationId: string, catalogo: EspecieCatalogo[]) {
  const queryClient = useQueryClient();
  const clave = QUERY_ESPECIES(plantationId);
  return useMutation({
    mutationFn: ({ idsHabilitar, idsQuitar, ordenInicial }: Sincronizacion) =>
      sincronizarEspecies(plantationId, idsHabilitar, idsQuitar, ordenInicial),
    onMutate: async ({ idsHabilitar, idsQuitar }) => {
      await queryClient.cancelQueries({ queryKey: clave });
      const previas = queryClient.getQueryData<EspecieConUso[]>(clave) ?? [];
      queryClient.setQueryData<EspecieConUso[]>(
        clave,
        aplicarSincronizacion(previas, catalogo, idsHabilitar, idsQuitar),
      );
      return { previas };
    },
    onError: (_error, _variables, contexto) => {
      if (contexto) queryClient.setQueryData(clave, contexto.previas);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });
}

/** Aplica el batch al cache: quita las bajas y agrega (append) las altas. */
function aplicarSincronizacion(
  previas: EspecieConUso[],
  catalogo: EspecieCatalogo[],
  idsHabilitar: string[],
  idsQuitar: string[],
): EspecieConUso[] {
  const quitar = new Set(idsQuitar);
  const conservadas = previas.filter((especie) => !quitar.has(especie.id));
  const altas = idsHabilitar
    .map((speciesId) => catalogo.find((especie) => especie.id === speciesId))
    .filter((especie): especie is EspecieCatalogo => Boolean(especie))
    .map((especie, indice) => ({
      ...especie,
      ordenVisual: conservadas.length + indice,
      tieneArboles: false,
    }));
  return [...conservadas, ...altas];
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
  const [aviso, setAviso] = useState<string | null>(null);
  const habilitadas = useMemo(() => idsHabilitadas(especies), [especies]);
  const bloqueadas = useMemo(() => idsBloqueadas(especies), [especies]);
  const idsVisibles = useMemo(
    () => filtrarCatalogo(catalogo, busqueda).map((especie) => especie.id),
    [catalogo, busqueda],
  );
  const toggle = useToggleEspecie(plantationId, catalogo);
  const sincronizar = useSincronizarEspecies(plantationId, catalogo);

  const contexto = { idsVisibles, habilitadas, bloqueadas };
  const estado = estadoMaestro(contexto);

  const alternar = (speciesId: string, habilitar: boolean) => {
    setAviso(null);
    toggle.mutate({ speciesId, habilitar, orden: especies.length });
  };

  const alternarTodas = () => {
    const plan = planificarAccionMasiva(contexto, accionDesdeEstado(estado));
    setAviso(plan.bloqueadasMantenidas > 0 ? avisoBloqueadas(plan.bloqueadasMantenidas) : null);
    if (plan.idsHabilitar.length === 0 && plan.idsQuitar.length === 0) return;
    sincronizar.mutate({
      idsHabilitar: plan.idsHabilitar,
      idsQuitar: plan.idsQuitar,
      ordenInicial: especies.length,
    });
  };

  return (
    <>
      <SpeciesChecklist
        catalogo={catalogo}
        habilitadas={habilitadas}
        bloqueadas={bloqueadas}
        onToggle={alternar}
        estadoMaestro={estado}
        onMaestro={alternarTodas}
        busqueda={busqueda}
        onBuscar={setBusqueda}
      />
      {aviso && (
        <p className={styles.avisoInfo} role="status">
          {aviso}
        </p>
      )}
      {(toggle.isError || sincronizar.isError) && (
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
