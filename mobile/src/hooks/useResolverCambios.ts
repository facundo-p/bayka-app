import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useLiveData } from '../database/liveQuery';
import { getCambiosPorResolver } from '../queries/cambiosPorResolverQueries';
import { resolverCambios, type Elecciones } from '../repositories/PlantationRepository';
import { conflictosParaResolver, resolverConflictosDeSync } from '../services/ConflictosParaResolverService';
import type { FallaAlResolver } from '../constants/conflictoDeSync';
import type { ConflictoParaResolver } from '../types/conflictoDeSync';
import { ELECCION, type ConflictoDeCampo, type Eleccion } from '../utils/conflictosDeEdicion';
import { claveDeConflicto, eleccionDeConflicto, eleccionesAGuardar, idDeConflicto } from '../utils/conflictosDeSync';
import { seccionesDeConflictos, type SeccionDeConflictos } from '../utils/seccionesDeConflictos';
import { vistaDeConflictoDeSync } from '../utils/vistaDeConflictoDeSync';
import type { VistaDeConflicto } from '../utils/vistaDeConflicto';
import type { CampoDePlantacion } from '../utils/camposDePlantacion';
import { useNetStatus } from './useNetStatus';

const MENSAJE_ERROR_AL_GUARDAR = 'No se pudo guardar la elección. Probá de nuevo.';

/** Cada tarjeta que no se guardó dice por qué: el motivo o el aviso de la falla. */
const mensajeDeFallidas = (n: number) => (n === 1
  ? 'Una elección no se pudo guardar y quedó pendiente. Su tarjeta dice por qué.'
  : `${n} elecciones no se pudieron guardar y quedaron pendientes. Cada tarjeta dice por qué.`);

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

type Fallas = Record<string, FallaAlResolver>;

function tarjetas(conflictos: ConflictoParaResolver[], elegidas: Record<string, Eleccion>, fallas: Fallas, enLinea: boolean) {
  return seccionesDeConflictos(conflictos).map((seccion) => ({
    ...seccion,
    conflictos: seccion.conflictos.map((c) => ({
      clave: claveDeConflicto(c.conflicto),
      vista: vistaDeConflictoDeSync(c, enLinea, fallas[idDeConflicto(c.conflicto)]),
      eleccion: eleccionDeConflicto(elegidas[claveDeConflicto(c.conflicto)], c.motivo),
    })),
  }));
}

/** Hasta que NetInfo responde se asume conexión: la foto intenta bajarse y, si no puede, ofrece reintentar. */
function useEnLinea(): boolean {
  const { isOnline, conexionConocida } = useNetStatus();
  return isOnline || !conexionConocida;
}

/**
 * Los conflictos de sincronización. Mientras se guarda no se recargan: cada elección
 * aplicada avisa un cambio y la lista se rearmaría una vez por conflicto.
 */
function useConflictosVivos(plantacionId: string) {
  const pausa = useRef(false);
  const ultimos = useRef<ConflictoParaResolver[]>([]);
  const { data, refresh } = useLiveData(async () => {
    if (pausa.current) return ultimos.current;
    ultimos.current = await conflictosParaResolver(plantacionId);
    return ultimos.current;
  }, [plantacionId]);
  async function sinRecargar<T>(tarea: () => Promise<T>): Promise<T> {
    pausa.current = true;
    try {
      return await tarea();
    } finally {
      pausa.current = false;
      refresh();
    }
  }
  return { data, sinRecargar };
}

/** Una sección por grupo y por árbol, con la elección de cada conflicto y lo que no se pudo guardar. */
function useConflictosDeSync(plantacionId: string) {
  const enLinea = useEnLinea();
  const { data, sinRecargar } = useConflictosVivos(plantacionId);
  const [elegidas, setElegidas] = useState<Record<string, Eleccion>>({});
  const [fallas, setFallas] = useState<Fallas>({});
  const conflictos = useMemo(() => data ?? [], [data]);
  const secciones: SeccionDeConflictos<TarjetaDeSync>[] = useMemo(
    () => tarjetas(conflictos, elegidas, fallas, enLinea), [conflictos, elegidas, fallas, enLinea],
  );
  const elegir = (clave: string, eleccion: Eleccion) => setElegidas((previas) => ({ ...previas, [clave]: eleccion }));
  const guardar = () => sinRecargar(async () => {
    const fallidas = await resolverConflictosDeSync(eleccionesAGuardar(conflictos, elegidas));
    setFallas(Object.fromEntries(fallidas.map((f) => [idDeConflicto(f), f.falla])));
    return fallidas.length;
  });
  return { cargando: data === undefined, conflictos, secciones, elegir, guardar };
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

/** El error a mostrar, o null si se guardó todo y ya se fue de la pantalla. */
async function guardarYAvisar(guardarTodo: () => Promise<number>, alTerminar: () => void): Promise<string | null> {
  try {
    const fallidas = await guardarTodo();
    if (fallidas > 0) return mensajeDeFallidas(fallidas);
    alTerminar();
    return null;
  } catch {
    return MENSAJE_ERROR_AL_GUARDAR;
  }
}

/** Guarda todo junto: los campos de la plantación y cada conflicto de sincronización. Un segundo toque no hace nada. */
function useGuardado(guardarTodo: () => Promise<number>, alTerminar: () => void) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);
  async function guardar() {
    if (enCurso.current) return;
    enCurso.current = true;
    setGuardando(true);
    setError(null);
    setError(await guardarYAvisar(guardarTodo, alTerminar));
    enCurso.current = false;
    setGuardando(false);
  }
  return { guardar, guardando, error };
}

/** Estado de "Resolver cambios": la elección por dato y el guardado de todas juntas. */
export function useResolverCambios(plantacionId: string) {
  const router = useRouter();
  const plantacion = useCambiosDePlantacion(plantacionId);
  const { guardar: guardarDeSync, ...deSync } = useConflictosDeSync(plantacionId);
  const guardado = useGuardado(async () => {
    await resolverCambios(plantacionId, eleccionesCompletas(plantacion.conflictos, plantacion.elecciones));
    return guardarDeSync();
  }, () => router.back());
  return {
    ...plantacion,
    ...guardado,
    cargando: plantacion.cargando || deSync.cargando,
    secciones: deSync.secciones,
    elegirEnSync: deSync.elegir,
    cantidad: plantacion.conflictos.length + deSync.conflictos.length,
    despues: () => router.back(),
  };
}
