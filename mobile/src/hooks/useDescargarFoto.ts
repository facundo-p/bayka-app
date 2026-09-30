import { useCallback, useState } from 'react';

import { descargarFotoRemota } from '../services/SyncService';
import { notifyDataChanged } from '../database/liveQuery';

/** Baja de a una la foto de un árbol que está en la nube y no en el celular. */
export function useDescargarFoto(treeId: string, storagePath: string, onDescargada?: (uri: string) => void) {
  const [descargando, setDescargando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const descargar = useCallback(async () => {
    setDescargando(true);
    setFallo(false);
    try {
      const uri = await descargarFotoRemota(treeId, storagePath);
      if (!uri) {
        setFallo(true);
        return;
      }
      notifyDataChanged();
      onDescargada?.(uri);
    } finally {
      setDescargando(false);
    }
  }, [treeId, storagePath, onDescargada]);

  return { descargar, descargando, fallo };
}
