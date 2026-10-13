import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CLAVE_QUERY, FAMILIAS_ARBOLES_FILTRADOS, familia } from '../../queries/clavesQuery';
import type { ArbolDetalle } from '../../queries/dataExplorerQueries';
import { FotoCambiadaError, quitarFotoDeArbol } from '../../repositories/fotoDeArbol';

/** Lo que el panel necesita para ofrecer eliminar la foto; sin esto, no se ofrece. */
export interface EliminacionDeFoto {
  /** null si puede; si no, por qué el botón está deshabilitado. */
  motivoBloqueo: string | null;
  /** Recibe el árbol como quedó en el server. */
  onActualizado: (arbol: ArbolDetalle) => void;
}

/** La foto cuenta en la tabla (filtro con/sin foto), el reporte y los stats de la plantación. */
const CLAVES_AFECTADAS = [
  ...FAMILIAS_ARBOLES_FILTRADOS,
  familia(CLAVE_QUERY.plantaciones),
  familia(CLAVE_QUERY.plantacion),
];

/**
 * Quita la foto que se ve. Si alguien la cambió desde otro lado, el árbol pasa
 * a mostrar la nueva y el aviso lo explica; cualquier otro error queda en la
 * confirmación.
 */
function useAccionEliminar(arbol: ArbolDetalle, eliminacion: EliminacionDeFoto | undefined) {
  const [aviso, setAviso] = useState<string | null>(null);
  const eliminar = async () => {
    if (!arbol.fotoUrl || !eliminacion) return;
    try {
      await quitarFotoDeArbol(arbol.id, arbol.fotoUrl);
      eliminacion.onActualizado({ ...arbol, fotoUrl: null });
    } catch (error) {
      if (!(error instanceof FotoCambiadaError)) throw error;
      eliminacion.onActualizado({ ...arbol, fotoUrl: error.vigente });
      setAviso(error.message);
    }
  };
  return { aviso, setAviso, eliminar };
}

/** Pedir confirmación, eliminar y refrescar lo que cuenta fotos. */
export function useEliminarFoto(arbol: ArbolDetalle, eliminacion: EliminacionDeFoto | undefined) {
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const { aviso, setAviso, eliminar } = useAccionEliminar(arbol, eliminacion);
  return {
    disponible: eliminacion !== undefined,
    motivoBloqueo: eliminacion?.motivoBloqueo ?? null,
    aviso,
    confirmando,
    pedir: () => {
      setAviso(null);
      setConfirmando(true);
    },
    cerrar: () => setConfirmando(false),
    eliminar,
    alCompletar: () =>
      Promise.all(CLAVES_AFECTADAS.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  };
}

export type EliminarFoto = ReturnType<typeof useEliminarFoto>;
