import { useCallback, useState } from 'react';
import type { ShowFn } from '../utils/alertHelpers';
import { confirmarReemplazarFoto } from '../utils/avisoReemplazarFoto';

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
  /** «Ver actual» del aviso: el visor que se abra no vuelve a preguntar al reemplazar. */
  onVerActual: (foto: { uri: string; treeId: string }) => void;
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
    confirmarReemplazarFoto(show, { subId: arbol.subId, fotoSynced: arbol.fotoSynced ?? true }, {
      onVerActual: () => onVerActual({ uri: fotoUrl, treeId: id }),
      onConfirm: () => { void capturarEn(id); },
    });
  }, [arbol, capturando, capturarEn, show, onVerActual]);

  return { fotografiar, capturando, deshabilitado: !arbol || capturando };
}
