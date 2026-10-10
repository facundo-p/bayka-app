import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY, familia } from '../../queries/clavesQuery';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { listarEspeciesDePlantacion, type EspecieDePlantacion } from '../../queries/especieQueries';
import { mensajeDeErrorDeEdicion } from '../../repositories/edicionDePlantacion';
import { cambiarEspecieDeArbol, ConflictoDeEspecieError } from '../../repositories/especieDeArbol';
import { arbolConEspecie, conNombreCientifico, especieElegida } from './cambioDeEspecie';

const ACCION_CAMBIAR_ESPECIE = 'cambiar la especie';

/** Lo que el panel necesita para ofrecer el cambio; sin esto, la especie es de solo lectura. */
export interface EdicionDeEspecie {
  plantationId: string;
  codigoPlantacion: string | null;
  /** Recibe el árbol con la especie que quedó en el server. */
  onActualizado: (arbol: ArbolDetalle) => void;
}

/** La especie aparece en la tabla, el dashboard y el mapa; el uso por especie
 *  (en la configuración) bloquea quitarla de la plantación. El selector se
 *  refresca por si la especie elegida ya no estaba habilitada. */
function clavesAfectadas(plantationId: string) {
  return [
    familia(CLAVE_QUERY.datosArboles),
    familia(CLAVE_QUERY.dashboard),
    familia(CLAVE_QUERY.mapa),
    CLAVE_QUERY.plantacionEspecies(plantationId),
    CLAVE_QUERY.especiesHabilitadas(plantationId),
  ];
}

function useEspeciesDePlantacion(plantationId: string, habilitada: boolean) {
  return useQuery({
    queryKey: CLAVE_QUERY.especiesHabilitadas(plantationId),
    queryFn: () => listarEspeciesDePlantacion(plantationId),
    enabled: habilitada,
  });
}

interface Guardado {
  arbol: ArbolDetalle;
  edicion: EdicionDeEspecie;
  elegida: string;
  especies: EspecieDePlantacion[] | undefined;
  alGuardar: () => void;
  alChocar: (especieId: string | null) => void;
}

/** Guarda la elegida; con conflicto, el árbol pasa a mostrar la especie del server. */
function useGuardarEspecie({ arbol, edicion, elegida, especies, alGuardar, alChocar }: Guardado) {
  const { plantationId, codigoPlantacion, onActualizado } = edicion;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cambiarEspecieDeArbol(arbol.id, elegida, arbol.especieId),
    onSuccess: (subId) => {
      onActualizado(
        arbolConEspecie(arbol, especieElegida(especies, elegida, subId), codigoPlantacion),
      );
      alGuardar();
    },
    onError: (error) => {
      if (!(error instanceof ConflictoDeEspecieError)) return;
      const vigente = conNombreCientifico(error.vigente, especies);
      onActualizado(arbolConEspecie(arbol, vigente, codigoPlantacion));
      alChocar(error.vigente.especieId);
    },
    onSettled: () =>
      Promise.all(
        clavesAfectadas(plantationId).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

/**
 * Elegir y guardar otra especie. Si alguien la cambió desde otro lado, el árbol
 * pasa a mostrar la del server y el formulario sigue abierto con el aviso.
 */
export function useCambioDeEspecie(arbol: ArbolDetalle, edicion: EdicionDeEspecie) {
  const [editando, setEditando] = useState(false);
  const [elegida, setElegida] = useState('');
  const especies = useEspeciesDePlantacion(edicion.plantationId, editando);
  const mutacion = useGuardarEspecie({
    arbol,
    edicion,
    elegida,
    especies: especies.data,
    alGuardar: () => setEditando(false),
    alChocar: (especieId) => setElegida(especieId ?? ''),
  });
  const abrir = () => {
    mutacion.reset();
    setElegida(arbol.especieId ?? '');
    setEditando(true);
  };
  return {
    editando,
    abrir,
    cancelar: () => setEditando(false),
    especies,
    elegida,
    setElegida,
    puedeGuardar: elegida !== '' && elegida !== arbol.especieId,
    guardar: () => mutacion.mutate(),
    guardando: mutacion.isPending,
    mensajeError: mensajeDeErrorDeEdicion(mutacion.error, ACCION_CAMBIAR_ESPECIE),
  };
}

export type CambioDeEspecie = ReturnType<typeof useCambioDeEspecie>;
