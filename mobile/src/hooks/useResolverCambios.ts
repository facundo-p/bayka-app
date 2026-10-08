import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useLiveData } from '../database/liveQuery';
import { getCambiosPorResolver } from '../queries/cambiosPorResolverQueries';
import { resolverCambios, type Elecciones } from '../repositories/PlantationRepository';
import { conflictosParaResolver, resolverConflictosDeSync, type ConflictoParaResolver } from '../services/ConflictosParaResolverService';
import { ELECCION, type ConflictoDeCampo, type Eleccion } from '../utils/conflictosDeEdicion';
import { claveDeConflicto, eleccionDeConflicto, eleccionesAGuardar } from '../utils/conflictosDeSync';
import { seccionesDeConflictos, type SeccionDeConflictos } from '../utils/seccionesDeConflictos';
import { vistaDeConflictoDeSync } from '../utils/vistaDeConflictoDeSync';
import type { VistaDeConflicto } from '../utils/vistaDeConflicto';
import type { CampoDePlantacion } from '../utils/camposDePlantacion';
import { useNetStatus } from './useNetStatus';

const MENSAJE_ERROR_AL_GUARDAR = 'No se pudo guardar la elección. Probá de nuevo.';

const mensajeDeFallidas = (n: number) => (n === 1
  ? 'Una elección no se pudo guardar y quedó pendiente. Revisá el motivo y probá de nuevo.'
  : `${n} elecciones no se pudieron guardar y quedaron pendientes. Revisá los motivos y probá de nuevo.`);

/** Sin elegir, queda el cambio propio: es lo que el usuario cargó. */
export function eleccionDe(elecciones: Elecciones, campo: CampoDePlantacion): Eleccion {
  return elecciones[campo] ?? ELECCION.mio;
}

/** Una elección por cada conflicto: lo que el usuario tocó y, en el resto, el propio. */
export function eleccionesCompletas(conflictos: ConflictoDeCampo[], elecciones: Elecciones): Elecciones {
  return Object.fromEntries(conflictos.map(({ campo }) => [campo, eleccionDe(elecciones, campo)]));
}

export interface TarjetaDeSync {
  clave: string;
  vista: VistaDeConflicto;
  eleccion: Eleccion;
}

type ConflictosDeSync = ConflictoParaResolver[];

function tarjetas(conflictos: ConflictosDeSync, elegidas: Record<string, Eleccion>, enLinea: boolean) {
  return seccionesDeConflictos(conflictos).map((seccion) => ({
    ...seccion,
    conflictos: seccion.conflictos.map((c) => ({
      clave: claveDeConflicto(c.conflicto),
      vista: vistaDeConflictoDeSync(c, enLinea),
      eleccion: eleccionDeConflicto(elegidas[claveDeConflicto(c.conflicto)], c.motivo),
    })),
  }));
}

/** Los conflictos de sincronización: una sección por grupo y por árbol, con la elección de cada uno. */
function useConflictosDeSync(plantacionId: string) {
  const { isOnline } = useNetStatus();
  const { data } = useLiveData(() => conflictosParaResolver(plantacionId), [plantacionId]);
  const [elegidas, setElegidas] = useState<Record<string, Eleccion>>({});
  const conflictos = useMemo(() => data ?? [], [data]);
  const secciones: SeccionDeConflictos<TarjetaDeSync>[] = useMemo(
    () => tarjetas(conflictos, elegidas, isOnline), [conflictos, elegidas, isOnline],
  );
  const elegir = (clave: string, eleccion: Eleccion) => setElegidas((previas) => ({ ...previas, [clave]: eleccion }));
  return { cargando: data === undefined, conflictos, secciones, elegir, aGuardar: () => eleccionesAGuardar(conflictos, elegidas) };
}

/** Los campos de la plantación que chocaron con la web (#634). */
function useCambiosDePlantacion(plantacionId: string) {
  const { data } = useLiveData(() => getCambiosPorResolver(plantacionId), [plantacionId]);
  const [elecciones, setElecciones] = useState<Elecciones>({});
  const conflictos = data?.conflictos ?? [];
  const elegir = (campo: CampoDePlantacion, eleccion: Eleccion) =>
    setElecciones((previas) => ({ ...previas, [campo]: eleccion }));
  return { lugar: data?.lugar ?? '', cargando: data === undefined, conflictos, elecciones, elegir };
}

/** Guarda todo junto: los campos de la plantación y cada conflicto de sincronización. */
function useGuardado(guardarTodo: () => Promise<number>, alTerminar: () => void) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const fallidas = await guardarTodo();
      if (fallidas > 0) setError(mensajeDeFallidas(fallidas));
      else alTerminar();
    } catch {
      setError(MENSAJE_ERROR_AL_GUARDAR);
    } finally {
      setGuardando(false);
    }
  }
  return { guardar, guardando, error };
}

/** Estado de "Resolver cambios": la elección por dato y el guardado de todas juntas. */
export function useResolverCambios(plantacionId: string) {
  const router = useRouter();
  const plantacion = useCambiosDePlantacion(plantacionId);
  const deSync = useConflictosDeSync(plantacionId);
  const { guardar, guardando, error } = useGuardado(async () => {
    await resolverCambios(plantacionId, eleccionesCompletas(plantacion.conflictos, plantacion.elecciones));
    return resolverConflictosDeSync(deSync.aGuardar());
  }, () => router.back());

  return {
    lugar: plantacion.lugar,
    cargando: plantacion.cargando || deSync.cargando,
    conflictos: plantacion.conflictos,
    elecciones: plantacion.elecciones,
    elegir: plantacion.elegir,
    secciones: deSync.secciones,
    elegirEnSync: deSync.elegir,
    cantidad: plantacion.conflictos.length + deSync.conflictos.length,
    guardar,
    guardando,
    error,
    despues: () => router.back(),
  };
}
