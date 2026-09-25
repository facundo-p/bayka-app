import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useLiveData } from '../database/liveQuery';
import { getCambiosPorResolver } from '../queries/cambiosPorResolverQueries';
import { resolverCambios, type Elecciones } from '../repositories/PlantationRepository';
import { ELECCION, type ConflictoDeCampo, type Eleccion } from '../utils/conflictosDeEdicion';
import type { CampoDePlantacion } from '../utils/camposDePlantacion';

const MENSAJE_ERROR_AL_GUARDAR = 'No se pudo guardar la elección. Probá de nuevo.';

/** Sin elegir, queda el cambio propio: es lo que el usuario cargó. */
export function eleccionDe(elecciones: Elecciones, campo: CampoDePlantacion): Eleccion {
  return elecciones[campo] ?? ELECCION.mio;
}

/** Una elección por cada conflicto: lo que el usuario tocó y, en el resto, el propio. */
export function eleccionesCompletas(conflictos: ConflictoDeCampo[], elecciones: Elecciones): Elecciones {
  return Object.fromEntries(conflictos.map(({ campo }) => [campo, eleccionDe(elecciones, campo)]));
}

/** Estado de "Resolver cambios": la elección por campo y el guardado de todas juntas. */
export function useResolverCambios(plantacionId: string) {
  const router = useRouter();
  const { data } = useLiveData(() => getCambiosPorResolver(plantacionId), [plantacionId]);
  const [elecciones, setElecciones] = useState<Elecciones>({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conflictos = data?.conflictos ?? [];

  const elegir = (campo: CampoDePlantacion, eleccion: Eleccion) =>
    setElecciones((previas) => ({ ...previas, [campo]: eleccion }));

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await resolverCambios(plantacionId, eleccionesCompletas(conflictos, elecciones));
      router.back();
    } catch {
      setError(MENSAJE_ERROR_AL_GUARDAR);
    } finally {
      setGuardando(false);
    }
  }

  return {
    lugar: data?.lugar ?? '',
    cargando: data === undefined,
    conflictos,
    elecciones,
    elegir,
    guardar,
    guardando,
    error,
    despues: () => router.back(),
  };
}
