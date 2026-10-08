import { useState } from 'react';
import type { FotoDeArbol } from '../components/TreePhotoViewer';
import type { PickPhoto } from '../services/photo/photoCaptureRules';
import type { ShowFn } from '../utils/alertHelpers';
import { confirmarQuitarFoto } from '../utils/avisoQuitarFoto';
import { confirmarReemplazoEnVisor, fotoAReemplazar } from '../utils/avisoReemplazarFoto';

type ArbolConFoto = { id: string; subId: string; fotoSynced?: boolean | null };

interface Params {
  arboles: readonly ArbolConFoto[];
  show: ShowFn;
  pickPhoto: PickPhoto;
  updatePhoto: (treeId: string, newUri: string) => Promise<void>;
  removePhoto: (treeId: string) => Promise<void>;
}

type Visor = Params & { setFoto: (foto: FotoDeArbol | null) => void };

function arbolDelGrupo(arboles: readonly ArbolConFoto[], treeId: string) {
  return arboles.find((t) => t.id === treeId);
}

function capturarReemplazo(visor: Visor, treeId: string) {
  void visor.pickPhoto().then((newUri) => {
    if (!newUri) return;
    void visor.updatePhoto(treeId, newUri);
    visor.setFoto({ uri: newUri, treeId });
  });
}

function reemplazar(visor: Visor, foto: FotoDeArbol) {
  const arbol = arbolDelGrupo(visor.arboles, foto.treeId);
  // Borrado con el visor abierto: ya no hay foto que reemplazar.
  if (!arbol) return;
  confirmarReemplazoEnVisor(visor.show, fotoAReemplazar(arbol),
    foto.reemplazoConfirmado, () => capturarReemplazo(visor, foto.treeId));
}

function quitar(visor: Visor, treeId: string) {
  const fotoSynced = arbolDelGrupo(visor.arboles, treeId)?.fotoSynced ?? true;
  confirmarQuitarFoto(visor.show, fotoSynced, () => {
    void visor.removePhoto(treeId);
    visor.setFoto(null);
  });
}

/** Foto abierta en el visor de la pantalla de registro, con su reemplazo y su borrado. */
export function useFotoDelVisor(params: Params) {
  const [foto, setFoto] = useState<FotoDeArbol | null>(null);
  const visor: Visor = { ...params, setFoto };
  return {
    foto,
    abrir: setFoto,
    cerrar: () => setFoto(null),
    handleReplacePhoto: (f: FotoDeArbol) => reemplazar(visor, f),
    handleRemovePhoto: (treeId: string) => quitar(visor, treeId),
  };
}
