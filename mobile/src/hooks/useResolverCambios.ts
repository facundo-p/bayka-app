import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useLiveData } from '../database/liveQuery';
import { getCambiosPorResolver } from '../queries/cambiosPorResolverQueries';
import { resolverCambio } from '../repositories/PlantationRepository';
import { ELECCION, type Eleccion } from '../utils/conflictosDeEdicion';
import type { CampoDePlantacion } from '../utils/camposDePlantacion';

type Elecciones = Partial<Record<CampoDePlantacion, Eleccion>>;

/** Sin elegir, queda el cambio propio: es lo que el usuario cargó. */
export function eleccionDe(elecciones: Elecciones, campo: CampoDePlantacion): Eleccion {
  return elecciones[campo] ?? ELECCION.mio;
}

/** Estado de "Resolver cambios": la elección por campo y el guardado de todas juntas. */
export function useResolverCambios(plantacionId: string) {
  const router = useRouter();
  const { data } = useLiveData(() => getCambiosPorResolver(plantacionId), [plantacionId]);
  const [elecciones, setElecciones] = useState<Elecciones>({});
  const [guardando, setGuardando] = useState(false);
  const conflictos = data?.conflictos ?? [];

  const elegir = (campo: CampoDePlantacion, eleccion: Eleccion) =>
    setElecciones((previas) => ({ ...previas, [campo]: eleccion }));

  async function guardar() {
    setGuardando(true);
    try {
      for (const { campo } of conflictos) await resolverCambio(plantacionId, campo, eleccionDe(elecciones, campo));
      router.back();
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
    despues: () => router.back(),
  };
}
