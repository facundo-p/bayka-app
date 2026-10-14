import { useCallback, useState } from 'react';
import type { ShowFn } from '../utils/alertHelpers';
import { confirmarReemplazarFoto, fotoAReemplazar } from '../utils/avisoReemplazarFoto';
import type { FotoDeArbol } from '../components/TreePhotoViewer';

export type ArbolFotografiable = {
  id: string;
  subId: string;
  fotoUrl?: string | null;
  fotoSynced?: boolean | null;
};

interface Params {
  arbol: ArbolFotografiable | null;
  /** Abre la cámara y guarda la foto en el árbol (marca el grupo pendiente de sync). */
  capturar: (treeId: string) => Promise<void>;
  show: ShowFn;
  /** «Ver actual» del aviso: abre el visor con el reemplazo ya confirmado. */
  onVerActual: (foto: FotoDeArbol) => void;
}

/**
 * Botón de foto de la botonera (#751): fotografía el árbol seleccionado en la tira. El árbol
 * se fija al tocar, así que un alta con la cámara abierta no le cambia el destino a la foto.
 */
export function useFotoDelSeleccionado({ arbol, capturar, show, onVerActual }: Params) {
  const [capturando, setCapturando] = useState(false);

  const capturarEn = useCallback(async (treeId: string) => {
    setCapturando(true);
    try { await capturar(treeId); } finally { setCapturando(false); }
  }, [capturar]);

  const fotografiar = useCallback(() => {
    if (!arbol || capturando) return;
    const { id, fotoUrl } = arbol;
    if (!fotoUrl) { void capturarEn(id); return; }
    confirmarReemplazarFoto(show, fotoAReemplazar(arbol), {
      onVerActual: () => onVerActual({ uri: fotoUrl, treeId: id, reemplazoConfirmado: true }),
      onConfirm: () => { void capturarEn(id); },
    });
  }, [arbol, capturando, capturarEn, show, onVerActual]);

  return { fotografiar, capturando, deshabilitado: !arbol || capturando };
}
