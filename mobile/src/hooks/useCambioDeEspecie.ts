/**
 * Cambiar la especie desde el detalle del árbol (#679): buscador sobre las especies
 * de la plantación, cambio sin confirmación (es reversible) y aviso con el ID nuevo.
 * También resuelve un conflicto con la especie del server.
 */
import { useState } from 'react';
import { useLiveData } from '../database/liveQuery';
import { getSpeciesForPlantation, type PlantationSpeciesItem } from '../repositories/PlantationSpeciesRepository';
import { cambiarEspecie, mantenerEspecieLocal, usarEspecieDelServidor } from '../repositories/TreeRepository';
import { avisoBreve } from '../utils/avisoBreve';
import { idDeArbol } from '../utils/codigoDePlantacion';
import { coincideBusqueda } from '../utils/normalizarTexto';

export const MENSAJE_ERROR_CAMBIO_DE_ESPECIE = 'No se pudo cambiar la especie.';

export const avisoEspecieCambiada = (idArbol: string) => `Especie cambiada. Nuevo ID: ${idArbol}`;

/** Por nombre común o científico. */
export function filtrarEspecies<T extends Pick<PlantationSpeciesItem, 'nombre' | 'nombreCientifico'>>(
  especies: readonly T[],
  busqueda: string,
): T[] {
  return especies.filter((especie) => coincideBusqueda([especie.nombre, especie.nombreCientifico], busqueda));
}

type ArbolACambiar = { id: string; especieId: string | null; plantacionCodigo: string | null };

/** Corre una escritura con su indicador de ocupado y avisa si falla. */
function useEscritura() {
  const [guardando, setGuardando] = useState(false);
  async function escribir(tarea: () => Promise<void>) {
    setGuardando(true);
    try {
      await tarea();
    } catch {
      avisoBreve(MENSAJE_ERROR_CAMBIO_DE_ESPECIE);
    } finally {
      setGuardando(false);
    }
  }
  return { guardando, escribir };
}

/** El buscador: abierto o no, lo tipeado y las especies que coinciden. */
function useBuscadorDeEspecies(plantacionId: string) {
  const { data: especies } = useLiveData(() => getSpeciesForPlantation(plantacionId), [plantacionId]);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  function abrir() {
    setBusqueda('');
    setAbierto(true);
  }
  return {
    especies: filtrarEspecies(especies ?? [], busqueda),
    abierto,
    abrir,
    cerrar: () => setAbierto(false),
    busqueda,
    setBusqueda,
  };
}

async function cambiarYAvisar(arbol: ArbolACambiar, especieId: string) {
  const resultado = await cambiarEspecie(arbol.id, especieId);
  if (resultado) avisoBreve(avisoEspecieCambiada(idDeArbol(resultado.subId, arbol.plantacionCodigo)));
}

export function useCambioDeEspecie(arbol: ArbolACambiar | null, plantacionId: string) {
  const buscador = useBuscadorDeEspecies(plantacionId);
  const { guardando, escribir } = useEscritura();

  function elegir(especieId: string) {
    buscador.cerrar();
    if (!arbol || especieId === arbol.especieId) return;
    void escribir(() => cambiarYAvisar(arbol, especieId));
  }

  return {
    ...buscador,
    guardando,
    elegir,
    usarDelServidor: () => arbol && escribir(() => usarEspecieDelServidor(arbol.id)),
    mantenerLocal: () => arbol && escribir(() => mantenerEspecieLocal(arbol.id)),
  };
}

export type CambioDeEspecieDelArbol = ReturnType<typeof useCambioDeEspecie>;
